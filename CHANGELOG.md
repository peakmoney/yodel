**Yodel follows [Semantic Versioning](http://semver.org/)**
## Change Log

**1.0.0** - <small>_2016-06-03_</small> -

##### Added
* Docker support
* Environment based config
* ES6 + ESLint
* Dotenv with sample config file

##### Removed
* Support for Node 0.x
* JSON config samples (replaced with dotenv sample)


**0.2.0** - <small>_2015-12-08_</small> -

##### Added
* Mocha.js
* Support for APN Feedback Service
* Testing for greater than Node 0.10.x
* Various test helpers
* AttributeError for Device validations

##### Changed
* iOS and Android notifications are now run asynchronously
* Pushed batch iOS notifications off to node-apn
* Styling changes here and there
* Tests for subscribe
* Refactored existing modules in to more proper models
* Added standardized jsdoc comments and file headers

##### Removed
* Vows.js
