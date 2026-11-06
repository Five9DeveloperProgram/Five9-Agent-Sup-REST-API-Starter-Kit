const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const root = path.resolve(__dirname, '..');
const migratedSamples = [
    'Agent Skill Dashboard.html',
    'Call Conference Transfer Example.html',
    'Call Conference Transfer Example - Dynamic SpeedDials.html',
    'Call Warm Transfer Example.html',
    'Disposition Call with specific Disposition Name.html',
    'cold_conference_transfer_sample.html',
].map(file => `usecase_samples/${file}`);

function readScripts(file) {
    const html = fs.readFileSync(path.join(root, file), 'utf8');
    return [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)]
        .map(match => match[1]).join('\n');
}

function loadSession(file, globals = {}) {
    const context = {
        document: { readyState: 'loading', addEventListener() {} },
        console: { log() {}, info() {}, error() {} },
        ...globals,
    };
    vm.createContext(context);
    vm.runInContext(readScripts(file) + '\nglobalThis.Session = Five9Session;', context);
    return new context.Session();
}

test('all sample scripts parse without jQuery or explicit token logging', () => {
    const files = ['agent_VCC_boilerplate.html', ...fs.readdirSync(path.join(root, 'usecase_samples'))
        .filter(file => file.endsWith('.html')).map(file => `usecase_samples/${file}`)];
    for (const file of files) {
        const source = readScripts(file);
        new vm.Script(source, { filename: file });
        const html = fs.readFileSync(path.join(root, file), 'utf8');
        assert(!/jquery|\$\s*\(|\$\.(?:ajax|get|post)\s*\(/i.test(html), file);
        assert(!/console\w*\.(?:log|info)\([^;]*f9TokenId/.test(source), file);
    }
});

for (const file of ['agent_VCC_boilerplate.html', ...migratedSamples]) {
    test(`request failures retain Five9 detail and expired sessions fail closed: ${file}`, async () => {
        const errors = [];
        let response = { ok: false, status: 435, json: async () => ({ five9ExceptionDetail: { message: 'Disposition not available' } }) };
        const session = loadSession(file, {
            fetch: async () => response,
            console: { log() {}, info() {}, error: error => errors.push(error.message) },
        });
        assert.equal(await session.f9ApiMethod('https://offline.invalid', 'PUT'), null);
        assert.equal(errors.pop(), 'Five9 request failed (435): Disposition not available');
        response = { ok: false, status: 401, json: async () => { throw new Error('Not JSON'); } };
        assert.equal(await session.f9ApiMethod('https://offline.invalid', 'GET'), null);
        assert.equal(errors.pop(), 'Five9 request failed (401)');
        assert.equal(await session.getSessionMetadata(), false);
    });

    test(`reconnect retains handlers and replaces socket: ${file}`, async () => {
        const session = loadSession(file);
        const registrations = [];
        let closed = 0;
        let handled = 0;
        const handler = { handle() { handled++; } };
        session.connectSocket = async (endpoint, handlers) => {
            registrations.push({ endpoint, handlers });
            return { close() { closed++; } };
        };
        await session.connectAgentWebsocket({ 29: handler });
        const originalSocket = session.agentSocket;
        await session.reinitializeWebSocket({
            dataCenters: [{ apiUrls: [{ host: 'offline.invalid', port: '443' }] }],
        });
        assert.equal(closed, 1);
        assert.notEqual(session.agentSocket, originalSocket);
        assert.equal(registrations[1].handlers[29], handler);
        registrations[1].handlers[29].handle();
        assert.equal(handled, 1);
        assert.match(registrations[1].endpoint, /offline.invalid/);
        assert.equal(typeof registrations[1].handlers[73].handle, 'function');
    });
}

test('click-to-call validates destinations and preserves request semantics', async () => {
    const requests = [];
    let response = { ok: true, text: async () => '' };
    const session = loadSession('usecase_samples/clickToCall button - vanillaJs.html', {
        fetch: async (url, options) => { requests.push({ url, options }); return response; },
    });
    session.base_api_url_agents = 'https://offline.invalid/appsvcs/rs/svc';
    session.f9UserId = 'test-agent';
    session.getAgentCampaigns = async () => ({ Test: { id: 'test-campaign' } });
    assert.equal(await session.callExternalNumber(' 000 ', null, 'test-campaign'), null);
    assert.deepEqual(JSON.parse(requests[0].options.body), { number: '000', campaignId: 'test-campaign' });
    assert.equal(requests[0].options.credentials, 'include');
    assert.equal(requests[0].options.method, 'POST');
    await session.callExternalNumber('000', 'Test');
    await assert.rejects(session.callExternalNumber('000', 'Missing'), /not available/);
    await assert.rejects(session.callExternalNumber(' ', 'Test'), /required/);
    assert.equal(requests.length, 2);
    response = { ok: false, status: 403 };
    await assert.rejects(session.callExternalNumber('000', 'Test'), /403/);
});

test('missing speed dial never initiates a transfer', async () => {
    const session = loadSession('usecase_samples/Call Warm Transfer Example.html');
    session.getDomainSpeedDials = async () => [];
    session.f9ApiMethod = () => assert.fail('Unexpected transfer request');
    await assert.rejects(session.initiateTransferToSpeedDial('call', 'Missing'), /not available/);
});

test('Salesforce sample uses current endpoint and CAV metadata shapes', async () => {
    const source = readScripts('usecase_samples/Set Salesforce ID on Call Arrival - SweetAlert.html');
    const classSource = source.slice(source.indexOf('class f9socketEvent'), source.indexOf('function onDocumentReady'));
    const Session = new Function('console', classSource + '\nreturn Five9Session;')({ log() {}, error() {} });
    const session = new Session();
    session.setEndpoints({ dataCenters: [{ apiUrls: [{ host: 'offline.invalid', port: '443' }] }] });
    assert.equal(session.base_api_url_agents, 'https://offline.invalid:443/appsvcs/rs/svc');
    assert.match(session.base_websocket_api_url_agent, /^wss:\/\/offline.invalid:443\//);
    session.f9ApiMethod = async () => [{ group: 'Salesforce', name: 'id', id: 'cav-id' }];
    await session.getDomainCavs();
    assert.equal(session.CAVs.Salesforce.id.id, 'cav-id');
    let closed = 0;
    session.connectSocket = async () => ({ close() { closed++; } });
    await session.connectAgentWebsocket();
    session.newMetadata = { dataCenters: [{ apiUrls: [{ host: 'new.offline.invalid', port: '443' }] }] };
    await session.commonSocketEventHanders[73].handle({ context: { eventReason: 'COMPLETED' } });
    assert.equal(closed, 1);
    assert.equal(session.base_api_url_agents, 'https://new.offline.invalid:443/appsvcs/rs/svc');
});

for (const [file, indentation] of [
    ['Call Conference Transfer Example.html', 24],
    ['Call Conference Transfer Example - Dynamic SpeedDials.html', 20],
    ['cold_conference_transfer_sample.html', 20],
]) {
    test(`participant removal does not depend on call ordering: ${file}`, async () => {
        const source = readScripts(`usecase_samples/${file}`);
        const start = source.indexOf('async function () {', source.indexOf('button.addEventListener("click", async function () {'));
        const end = source.indexOf('\n' + ' '.repeat(indentation) + '});', start);
        const callback = source.slice(start, end) + '\n}';
        const alerts = [];
        const removed = [];
        const control = { style: { display: '' } };
        let calls = [];
        let accepted = false;
        const session = {
            getCurrentCalls: async () => calls,
            disconnectConferenceParticipant: async callId => { removed.push(callId); return accepted ? {} : null; },
        };
        const handler = new Function('session', 'window', 'document', 'return ' + callback)(session,
            { alert: message => alerts.push(message) },
            { querySelectorAll: () => [control], querySelector: () => control });
        await handler();
        assert.match(alerts.pop(), /No conference participant/);
        assert.equal(removed.length, 0);
        calls = [{ id: 'participant', state: 'CONFERENCE_PARTICIPANT_TALKING' }, { id: 'original', state: 'TALKING' }];
        await handler();
        assert.match(alerts.pop(), /rejected/);
        assert.equal(control.style.display, '');
        accepted = true;
        await handler();
        assert.deepEqual(removed, ['participant', 'participant']);
        assert.equal(control.style.display, 'none');
    });
}

for (const [file, attribute] of [
    ['Call Warm Transfer Example.html', 'destination'],
    ['Disposition Call with specific Disposition Name.html', 'disposition'],
]) {
    test(`click guards: ${file}`, async () => {
        const source = readScripts(`usecase_samples/${file}`);
        const callback = source.match(/button.addEventListener\("click", (async function \(event\) \{[\s\S]*?)\n                        \}\);/)[1] + '\n}';
        const alerts = [];
        let mutations = 0;
        let hasCall = false;
        let configured = false;
        let accepted = true;
        const button = { disabled: false, getAttribute: () => attribute === 'destination' ? 'campaign:Test' : 'Test' };
        const mutate = async () => { mutations++; return accepted ? {} : null; };
        const session = {
            getCurrentCalls: async () => hasCall ? [{ id: 'call', campaignId: 'campaign' }] : [],
            getInboundCampaigns: async () => configured ? [{ name: 'Test', id: 'campaign' }] : [],
            getCampaignDispositions: async () => ({ dispositions: configured ? [{ id: '0', name: 'Test', channelTypes: { CALL: { filters: ['VOICE_DISPOSE_CALL_OR_VOICEMAIL'] } } }] : [] }),
            initiateTransferToCampaign: mutate,
            disposeCurrentCall: mutate,
        };
        const handler = new Function('session', 'button', 'window', 'return ' + callback)(session, button, {
            alert: message => alerts.push(message),
        });
        await handler({ currentTarget: button });
        assert.match(alerts.pop(), /No active call/);
        assert.equal(mutations, 0);
        hasCall = true;
        await handler({ currentTarget: button });
        assert.match(alerts.pop(), /not available/);
        assert.equal(mutations, 0);
        configured = true;
        accepted = false;
        await handler({ currentTarget: button });
        assert.match(alerts.pop(), /rejected/);
        assert.equal(mutations, 1);
        accepted = true;
        await handler({ currentTarget: button });
        assert.equal(alerts.length, 0);
        assert.equal(mutations, 2);
        assert.equal(button.disabled, false);
    });
}

for (const [file, indentation, operation] of [
    ['Disposition Call with specific Disposition Name.html', 24, 'VOICE_DISPOSE_CALL_OR_VOICEMAIL'],
    ['Call Conference Transfer Example.html', 24, 'VOICE_END_CONFERENCE'],
    ['Call Conference Transfer Example - Dynamic SpeedDials.html', 20, 'VOICE_END_CONFERENCE'],
    ['cold_conference_transfer_sample.html', 20, 'VOICE_END_CONFERENCE'],
]) {
    test(`named dispositions must allow the requested operation: ${file}`, async () => {
        const source = readScripts(`usecase_samples/${file}`);
        const marker = source.indexOf('const targetDisposition =');
        const start = source.lastIndexOf('async function (event)', marker);
        const end = source.indexOf('\n' + ' '.repeat(indentation) + '});', marker);
        const callback = source.slice(start, end) + '\n}';
        const alerts = [];
        const requests = [];
        let filters = ['VOICE_TRANSFER_CALL'];
        let flags = [];
        let confirmed = false;
        const button = { disabled: false, getAttribute: () => 'Test' };
        const mutate = async (callId, dispositionId) => { requests.push({ callId, dispositionId }); return {}; };
        const session = {
            getCurrentCalls: async () => [{ id: 'call', campaignId: 'campaign' }],
            getCampaignDispositions: async () => ({ dispositions: [{ id: 0, name: 'Test', flags, channelTypes: { CALL: { filters } } }] }),
            disposeCurrentCall: mutate,
            leaveConference: mutate,
        };
        const handler = new Function('session', 'button', 'window', 'console', 'return ' + callback)(session, button,
            { alert: message => alerts.push(message), confirm: () => confirmed }, { log() {} });
        await handler({ currentTarget: button });
        assert.equal(requests.length, 0);
        assert.equal(alerts.length, 1);
        filters = [operation];
        if (operation === 'VOICE_DISPOSE_CALL_OR_VOICEMAIL') {
            flags = ['MUST_CONFIRM'];
            await handler({ currentTarget: button });
            assert.equal(requests.length, 0);
            confirmed = true;
        }
        await handler({ currentTarget: button });
        assert.deepEqual(requests, [{ callId: 'call', dispositionId: 0 }]);
    });
}