const EventEmitter = require('events');
const XError = require('xerror');

const COMBINED = new Symbol();
const DEFAULT_WARN_DELAY = 200;

global.simpleProfiler = global.simpleProfiler || {};

class Profiler extends EventEmitter {

	constructor(namespace) {
		super();

		this.namespace = namespace;
		this.activeBlocks = {};
		this.blockAggregates = {};
		this.events = Array(10);
		this.warnings = Array(10);

		if (global.simpleProfiler[namespace]) {
			this.warn(new XError(XError.ALREADY_EXISTS, `Profiler '${namespace}' already exists.`));
		} else {
			global.simpleProfiler[namespace] = this;
		}
	}

	begin(name, warnDelay = DEFAULT_WARN_DELAY) {
		this.activeBlocks[name] = {
			name,
			start: new Date()
		};

		this.events.push(`begin '${name}'`);
		this.events.shift();

		return {
			end: () => this.end(name)
		};
	}

	end(name) {
		const endTime = new Date();
		const block = this.activeBlocks[name];

		if (!block) return;

		const duration = endTime - block.start;

		delete this.activeBlocks[name];

		if (!this.blockAggregates[name]) {
			this.blockAggregates[name] = {
				count: 0,
				avg: 0,
				min: Infinity,
				max: -Infinity
			};
		}

		const aggregate = this.blockAggregates[name];

		aggregate.avg = (aggregate.count * aggregate.avg + duration) / (aggregate.count + 1);
		aggregate.count += 1;

		if (duration < aggregate.min) aggregate.min = duration;
		if (duration > aggregate.max) aggregate.max = duration;

		this.events.push(`end '${name}' (${duration})`);
		this.events.shift();

		return this;
	}

	wrap(fn, name, warnDelay = DEFAULT_WARN_DELAY) {
		this.begin(name, warnDelay);
		fn();
		this.end(name);
	}

	warn(warning) {
		this.warnings.push(warning);
		this.events.shift();
		this.emit('warning', warning);
	}

	getStats(name) {
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
