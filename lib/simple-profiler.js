const EventEmitter = require('events');
const XError = require('xerror');

const COMBINED = new Symbol();
const DEFAULT_WARN_DELAY = 200;

global.simpleProfiler = global.simpleProfiler || {};

class Profiler extends EventEmitter {

	constructor(namespace) {
		super();

		this.namespace = namespace;
		this.activeBlocksById = {};
		this.activeBlocksByName = {};
		this.blockAggregates = {};
		this.events = Array(10);
		this.warnings = Array(10);
		this.idCounter = 0;

		if (global.simpleProfiler[namespace]) {
			this.warn(new XError(XError.ALREADY_EXISTS, `Profiler '${namespace}' already exists.`));
		} else {
			global.simpleProfiler[namespace] = this;
		}
	}

	begin(name, warnDelay = DEFAULT_WARN_DELAY) {
		const id = ++this.idCounter;

		const block = {
			id,
			name,
			startedOn: new Date(),
			end: () => this.end(id)
		};

		this.activeBlocksById[id] = this.activeBlocksByName[name] = block;

		this.events.push(`begin '${name}'`);
		this.events.shift();

		return block;
	}

	end(id) {
		const endedOn = new Date();
		const block = (typeof id === 'number') ? this.activeBlocksById[id] : this.activeBlocksByName[id];

		if (typeof block !== 'object') return;

		const duration = endedOn - block.startedOn;
		block.endedOn = endedOn;
		block.duration = duration;

		delete this.activeBlocksById[block.id];
		delete this.activeBlocksByName[block.name];

		if (!this.blockAggregates[block.name]) {
			this.blockAggregates[block.name] = {
				count: 0,
				avg: 0,
				min: Infinity,
				max: -Infinity
			};
		}

		const aggregate = this.blockAggregates[block.name];

		aggregate.avg = (aggregate.count * aggregate.avg + duration) / (aggregate.count + 1);
		aggregate.count += 1;

		if (duration < aggregate.min) aggregate.min = duration;
		if (duration > aggregate.max) aggregate.max = duration;

		this.events.push(`end '${block.name}' (${duration})`);
		this.events.shift();

		return this;
	}

	wrap(fn, id, warnDelay = DEFAULT_WARN_DELAY) {
		this.begin(id, warnDelay);
		fn();
		this.end(id);
	}

	warn(warning) {
		this.warnings.push(warning);
		this.events.shift();
		this.emit('warning', warning);
	}

	getStats(name) {
		if (typeof name === 'number') name = this.activeBlocksById[name].name;
		if (name) return this.blockAggregates[name];
		return this.blockAggregates;
	}

	getEvents() {
		return this.events;
	}

	getWarnings() {
		return this.warnings;
	}

}

Profiler.combined = new Profiler(COMBINED);

module.exports = Profiler;
