angular.module('clubinho.services')

.service('Schedule', function($http, $q, $sce, apiConfig, CacheFactory) {
  var favKey = 'events-favorited',
    normalize = function(events) {
      return events.map(function(event) {
        var date = event.custom_fields.data_evento[0],
          hour = event.custom_fields.horario_evento[0],
          parts = [date.substring(0, 4), date.substring(4, 6), date.substring(6,8)];

        hour = hour.length == 2 ? hour + ':00' : hour;

        return {
          id: event.id,
          date: new Date(parts.join('/') + ' ' + hour),
          title: event.title_plain,
          excerpt: event.excerpt,
          content: event.content,
          favorite: methods.isFavorited(event),
          author: event.custom_fields.palestrante[0],
          cover: event.attachments && event.attachments.length ? 
            event.attachments[0].images.full.url : 
            null
        }
      });
    },
    updateCachedList = function(events) {
      var eventsCached = localStorage.getItem(scheduleStorageKey) || '[]',
        eventsCachedArray, newEventsToAdd = [];

      // already exist a saved list?
      if (eventsCached) {
        // transform string to array/object
        eventsCached = JSON.parse(eventsCached);

        // get events id to be easier to search for new event
        eventsCachedArray = eventsCached.map(function(event) {
          return event.id;
        });

        // seaching for new events to add
        events.forEach(function(event, i, object) {
          if (eventsCachedArray.indexOf(event.id) === -1) {
            newEventsToAdd.push(event);
          }
        });

        // merging new array with old one
        eventsCached = eventsCached.concat(newEventsToAdd);
      } else {
        eventsCached = events;
      }

      // cleaning array to be lighter to save
      eventsCached = eventsCached.map(function(event) {
        return {
          id: event.id,
          date: event.date,
          title: event.title,
        }
      });

      // updating array
      localStorage.setItem(scheduleStorageKey, JSON.stringify(eventsCached));

      return events;
    },
    methods = {
      getList: function() {
        var promise = $http.get(apiConfig.baseUrl + 'api/get_posts/?post_type=agenda', {
            cache: CacheFactory.get('scheduleCache')
          }),
          deferred = deferred || $q.defer();

        promise.then(function(schedule) {
          if (schedule.data.status == apiConfig.status.success) {
            deferred.resolve(updateCachedList(normalize(schedule.data.posts)));
          } else {
            deferred.reject(apiConfig.error);  
          }
        }, function(reason) {
          deferred.reject(reason);
        });

        return deferred.promise;
      }, 

      isFavorited: function(event) {
        var favorites = JSON.parse(localStorage.getItem(favKey) || '[]');

        return favorites.indexOf(event.id) != -1
      },

      setFavorite: function(event) {
        var favorites = JSON.parse(localStorage.getItem(favKey) || '[]'),
          setted = false;

        if (favorites.indexOf(event.id) == -1) {
          favorites.push(event.id);
          setted = true;
        } else {
          favorites.splice(favorites.indexOf(event.id), 1);
        }

        localStorage.setItem(favKey, JSON.stringify(favorites));

        return setted;
      },

      // get a event the FIRST event from schedule cache that WILL happen TODAY
      getNextEventFromNow: function() {
        var eventsCached = methods.getScheduleFromCache();

        if (eventsCached.length) {
          var now = new Date().getTime(),
            todaysEvents = eventsCached.filter(function(event) {
              // transforming strigified date do Date object again after parse
              event.date = new Date(event.date);

              var eventDate = new Date(event.date).setHours(0, 0, 0, 0);
              return eventDate == new Date().setHours(0, 0, 0, 0);
            }).sort(function(a, b) {
              // ordering events by date asc
              return a.date - b.date;
            }).filter(function(event) {
              // removing past events
              return event.date > now
            });

          if (todaysEvents.length) {
            return todaysEvents[0];
          }
        }
        
        return null;
      },

      getScheduleFromCache: function() {
        return JSON.parse(localStorage.getItem(scheduleStorageKey) || '[]');
      }
    },
    scheduleStorageKey = 'schedule-cached-list',
    deferred;

  // Cache configuration
  CacheFactory('scheduleCache', {
    maxAge: 90000, // Items added to this cache expire after 15 minutes.
    cacheFlushInterval: 3600000 * 24, // This cache will clear itself every hour.
    deleteOnExpire: 'aggressive', // Items will be deleted from this cache right when they expire.
    storageMode: 'localStorage',
    onExpire: function (key, value) {
      var eventsCached = localStorage.getItem(scheduleStorageKey),
          eventsExpiredIds;

      if (value && value['200'] && value['200'].posts.length) {
        eventsExpiredIds = value['200'].posts.map(function(event) {
          return event.id;
        });

        if (eventsCached) {
          eventsCached = JSON.parse(eventsCached);

          // Caso a lista de eventos cacheado tenha algum evento vindo da URL cacheada, remove ela
          eventsCached.forEach(function(event, i, object) {
            if (eventsExpiredIds.indexOf(event.id) !== -1) {
              object.splice(i, 1);
            }
          });

          localStorage.setItem(scheduleStorageKey, JSON.stringify(eventsCached));
        }
      }
    }
  });

  return methods;
});
