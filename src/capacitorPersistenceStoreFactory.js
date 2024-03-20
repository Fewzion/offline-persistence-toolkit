define(["./impl/capacitorPersistenceStore"],
       function(CapacitorPersistenceStore) {
  'use strict';

  var CapacitorPersistenceStoreFactory = function (storage) {
    this._storage = storage;
  }

  CapacitorPersistenceStoreFactory.prototype.createPersistenceStore = function (name, options) {
    var store = new CapacitorPersistenceStore(name);
    var storeOptions = {};
    if (this._storage) {
      storeOptions.storage = this._storage;
    }
    if (options) {
      for (var key in options) {
        if (Object.prototype.hasOwnProperty.call(options, key)) {
          storeOptions[key] = options[key];
        }
      }
    }
    return store.Init(storeOptions).then(function () {
      return store;
    });
  }  

  return CapacitorPersistenceStoreFactory;
});
