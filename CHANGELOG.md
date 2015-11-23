## Change Log

**0.2.0** - <small>_November 23, 2015_</small> -

* Upgraded node-apn, knex, and commander.
* notifyIos() and notifyAndroid() are now run concurrently as promises.
* Devices returned via batched APN feedback will be automatically unsubscribed.
