var C = require( '../constants/constants' ),
	SubscriptionRegistry = require( '../utils/subscription-registry' ),
	messageBuilder = require( '../message/message-builder' );

/**
 * Handles incoming and outgoing messages for the EVENT topic.
 * 
 * @param {Object} options deepstream options
 * 
 * @constructor
 */
var EventHandler = function( options ) {
	this._options = options;
	this._subscriptionRegistry = new SubscriptionRegistry( options, C.TOPIC.EVENT );
};

/**
 * The main distribution method. Routes messages to functions
 * based on the provided action parameter of the message
 * 
 * @param {SocketWrapper} socketWrapper
 * @param {Object} message parsed and permissioned deepstream message
 * 
 * @public
 * @returns {void}
 */
EventHandler.prototype.handle = function( socketWrapper, message ) {

	if( message.action === C.ACTIONS.SUBSCRIBE ) {
		this._addSubscriber( socketWrapper, message );
	}

	else if( message.action === C.ACTIONS.UNSUBSCRIBE ) {
		this._removeSubscriber( socketWrapper, message );
	}

	else if( message.action === C.ACTIONS.EVENT ) {
		this._triggerEvent( socketWrapper, message );
	}

	else {
		this._options.logger.log( C.LOG_LEVEL.WARN, C.EVENT.UNKNOWN_ACTION, message.action );

		if( socketWrapper !== C.SOURCE_MESSAGE_CONNECTOR ) {
			socketWrapper.sendError( C.TOPIC.EVENT, C.EVENT.UNKNOWN_ACTION, 'unknown action ' + message.action );
		}
	}
};

/**
 * Handler for the SUBSCRIBE action. Adds the socketWrapper as
 * a subscriber to the specified event name
 * 
 * @param {SocketWrapper} socketWrapper
 * @param {Object} message parsed and permissioned deepstream message
 * 
 * @private
 * @returns {void}
 */
EventHandler.prototype._addSubscriber = function( socketWrapper, message ) {
	if( this._validateSubscriptionMessage( socketWrapper, message ) ) {
		this._subscriptionRegistry.subscribe( message.data[ 0 ], socketWrapper );
	}
};

/**
 * Handler for the UNSUBSCRIBE action. Removes the socketWrapper as
 * a subscriber from the specified event name
 * 
 * @param {SocketWrapper} socketWrapper
 * @param {Object} message parsed and permissioned deepstream message
 * 
 * @private
 * @returns {void}
 */
EventHandler.prototype._removeSubscriber = function( socketWrapper, message ) {
	if( this._validateSubscriptionMessage( socketWrapper, message ) ) {
		this._subscriptionRegistry.unsubscribe( message.data[ 0 ], socketWrapper );
	}
};

/**
 * Notifies subscribers of events. This method is invoked for the EVENT action. It can
 * be triggered by messages coming in from both clients and the message connector.
 * 
 * @param {String|SocketWrapper} messageSource If messageSource is the constant SOURCE_MESSAGE_CONNECTOR
 * 												the message was received from the message connector
 * 
 * @param {Object} message parsed and permissioned deepstream message
 * 
 * @private
 * @returns {void}
 */
EventHandler.prototype._triggerEvent = function( messageSource, message ) {
	if( typeof message.data[ 0 ] !== 'string' ) {
		if( messageSource !== C.SOURCE_MESSAGE_CONNECTOR ) {
			messageSource.sendError( C.TOPIC.EVENT, C.EVENT.INVALID_MESSAGE_DATA, message.raw );
		}
		
		return;
	}
	this._options.logger.log( C.LOG_LEVEL.DEBUG, C.EVENT.TRIGGER_EVENT, message.raw );

	if( messageSource !== C.SOURCE_MESSAGE_CONNECTOR ) {
		this._options.messageConnector.publish( C.TOPIC.EVENT, message );
	}
	var outboundMessage = messageBuilder.getMsg( C.TOPIC.EVENT, C.ACTIONS.EVENT, message.data );
	this._subscriptionRegistry.sendToSubscribers( message.data[ 0 ], outboundMessage, messageSource );
};

/**
 * Makes sure that subscription message contains the name of the event. Sends an error to the client
 * if not
 * 
 * @param {SocketWrapper} socketWrapper
 * @param {Object} message parsed and permissioned deepstream message
 * 
 * @private
 * @returns {Boolean} is valid subscription message
 */
EventHandler.prototype._validateSubscriptionMessage = function( socketWrapper, message ) {
	if( message.data && message.data.length === 1 && typeof message.data[ 0 ] === 'string' ) {
		return true;
	} else {
		socketWrapper.sendError( C.TOPIC.EVENT, C.EVENT.INVALID_MESSAGE_DATA, message.raw );
		return false;
	}
};

module.exports = EventHandler;
