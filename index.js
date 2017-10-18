'use strict';

var async = require('./lib/async');

var apple = require('./lib/apple');
var google = require('./lib/google');
var windows = require('./lib/windows');
var amazonManager = require('./lib/amazonManager');
var constants = require('./constants');
var verbose = require('./lib/verbose');

var IS_WINDOWS = '<\/Receipt>';

var amazon;

function handlePromisedFunctionCb(resolve, reject) {
	return function _handlePromisedCallback(error, response) {
		if (error) {
			var errorData = { error: error, status: null, message: null };
			if (response !== null && typeof response === 'object') {
				errorData.status = response.status;
				errorData.message = response.message;
			}
			return reject(JSON.stringify(errorData));
		}
		return resolve(response);
	};
}

module.exports.APPLE = constants.SERVICES.APPLE;
module.exports.GOOGLE = constants.SERVICES.GOOGLE;
module.exports.WINDOWS = constants.SERVICES.WINDOWS;
module.exports.AMAZON = constants.SERVICES.AMAZON;

module.exports.config = function (configIn) {
	apple.readConfig(configIn);
	google.readConfig(configIn);
	windows.readConfig(configIn);
	amazon = amazonManager.create(configIn);
	verbose.setup(configIn);
};

module.exports.setup = function (cb) {
	if (!cb && Promise) {
		return new Promise(function (resolve, reject) {
			module.exports.setup(handlePromisedFunctionCb(resolve, reject));
		});
	}
	async.parallel([
		function (next) {
			apple.setup(next);
		},
		function (next) {
			google.setup(next);
		},
		function (next) {
			amazon.setup(next);
		}
	], cb);
};

module.exports.getService = function (receipt) {
	if (receipt.indexOf && receipt.indexOf(IS_WINDOWS) !== -1) {
		return module.exports.WINDOWS;
	}
	if (typeof receipt === 'object') {
		// receipt could be either Google or Amazon
		if (receipt.signature) {
			return module.exports.GOOGLE;
		} else {
			return module.exports.AMAZON;
		}
	}
	try {
		// receipt could be either Google or Amazon
		var parsed = JSON.parse(receipt);
		if (parsed.signature) {
			return module.exports.GOOGLE;
		} else {
			return module.exports.AMAZON;
		}
	} catch (error) {
		return module.exports.APPLE;
	}
};

module.exports.validate = function (service, receipt, sandbox, cb) {
	if (receipt === undefined && cb === undefined) {
		// we are given 1 argument as: const promise = .validate(receipt)
		receipt = service;
		service = module.exports.getService(receipt);
	}
	if (cb === undefined && typeof receipt === 'function') {
		// we are given 2 arguemnts as: .validate(receipt, cb)
		cb = receipt;
		receipt = service;
		service = module.exports.getService(receipt); 
	}
	if (!cb && Promise) {
		return new Promise(function (resolve, reject) {
			module.exports.validate(service, receipt, handlePromisedFunctionCb(resolve, reject));
		});
	}
	switch (service) {
		case module.exports.APPLE:
			apple.validatePurchase(null, receipt, sandbox, cb);
			break;
		case module.exports.GOOGLE:
			google.validatePurchase(null, receipt, cb);
			break;
		case module.exports.WINDOWS:
			windows.validatePurchase(receipt, cb);
			break;
		case module.exports.AMAZON:
			amazon.validatePurchase(null, receipt, cb);
			break;
		default:
			return cb(new Error('invalid service given: ' + service));
	}
};

module.exports.validateOnce = function (service, secretOrPubKey, receipt, cb) {
	if (receipt === undefined && cb === undefined) {
		// we are given 2 arguments as: const promise = .validateOnce(receipt, secretOrPubKey)
		receipt = service;
		service = module.exports.getService(receipt);
	}
	if (cb === undefined && typeof receipt === 'function') {
		// we are given 3 arguemnts as: .validateOnce(receipt, secretPubKey, cb)
		cb = receipt;
		receipt = service;
		service = module.exports.getService(receipt); 
	}
	
	if (!cb && Promise) {
		return new Promise(function (resolve, reject) {
			module.exports.validateOnce(service, secretOrPubKey, receipt, handlePromisedFunctionCb(resolve, reject));
		});
	}
	
	if (!secretOrPubKey && service !== module.exports.APPLE && service !== module.exports.WINDOWS) {
		verbose.log('<.validateOnce>', service, receipt);
		return cb(new Error('missing secret or public key for dynamic validation:' + service));
	}
	
	switch (service) {
		case module.exports.APPLE:
			apple.validatePurchase(secretOrPubKey, receipt, cb);
			break;
		case module.exports.GOOGLE:
			google.validatePurchase(secretOrPubKey, receipt, cb);
			break;
		case module.exports.WINDOWS:
			windows.validatePurchase(receipt, cb);
			break;
		case module.exports.AMAZON:
			amazon.validatePurchase(secretOrPubKey, receipt, cb);
			break;
		default:
			verbose.log('<.validateOnce>', secretOrPubKey, receipt);
			return cb(new Error('invalid service given: ' + service));
	}
};

module.exports.isValidated = function (response) {
	if (response && response.status === constants.VALIDATION.SUCCESS) {
		return true;
	}
	return false;
};

module.exports.isExpired = function (purchasedItem) {
	if (!purchasedItem || !purchasedItem.transactionId) {
		throw new Error('invalid purchased item given:\n' + JSON.stringify(purchasedItem));
	}
	if (purchasedItem.cancellationDate) {
		// it has been cancelled
		return true;
	}
	if (!purchasedItem.expirationDate) {
		// there is no exipiration date with this item
		return false;
	}
	if (Date.now() - purchasedItem.expirationDate >= 0) {
		return true;
	}
	// has not exipired yet
	return false;
};

module.exports.getPurchaseData = function (purchaseData, options) {
	if (!purchaseData || !purchaseData.service) {
		return null;
	}
	switch (purchaseData.service) {
		case module.exports.APPLE:
			return apple.getPurchaseData(purchaseData, options);
		case module.exports.GOOGLE:
			return google.getPurchaseData(purchaseData, options);
		case module.exports.WINDOWS:
			return windows.getPurchaseData(purchaseData, options);
		case module.exports.AMAZON:
			return amazon.getPurchaseData(purchaseData, options);
		default:
			return null;
	}
};

module.exports.refreshGoogleToken = function (cb) {
	if (!cb && Promise) {
		return new Promise(function (resolve, reject) {
			module.exports.refreshGoogleToken(handlePromisedFunctionCb(resolve, reject));
		});
	}
	google.refreshToken(cb);

};

// test use only
module.exports.reset = function () {
	// resets google setup
	google.reset();
};
