## Change Log

**0.2.0** - <small>_November 23, 2015_</small> -

* Tested support for Node 0.10.x and up to Node 4.x.
* Upgraded node-apn, knex, commander, and mysql packages.
* Replaced vows with mocha; removed `test/vows` in favor of `test/*.js`.
* Refactored `test/run` to spawn mocha as a child process.
* `notifyIos()` and `notifyAndroid()` now run concurrently as promises.
* Devices returned via batched APN feedback will be automatically unsubscribed.
