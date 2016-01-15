const EventEmitter = require('events');
const XError = require('xerror');

global.simpleProfiler = global.simpleProfiler || {};

const DEFAULT_WARN_DELAY = 200;
const stats = {};
const warnings = {};

class Profiler extends EventEmitter {

	constructor(namespace) {
		super();

		this.namespace = namespace;
		this.activeBlocksById = {};
		this.activeBlocksByName = {};
		this.stats = stats[namespace] = {};
		this.events = Array(10);
		this.warnings = warnings[namespace] = Array(10);
		this.idCounter = 0;

		if (global.simpleProfiler[namespace]) {
			this.emitWarning(new XError(XError.ALREADY_EXISTS, `Profiler '${namespace}' already exists.`));
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

		this.emitBegin(block);

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

		if (!this.stats[block.name]) {
			this.stats[block.name] = {
				count: 0,
				sum: 0,
				sumSq: 0,
				avg: 0,
				std: 0,
				min: Infinity,
				max: -Infinity
			};
		}

		const aggregate = this.stats[block.name];

		aggregate.count += 1;
		aggregate.sum += duration;
		aggregate.sumSq += duration * duration;
		aggregate.avg = aggregate.sum / aggregate.count;
		aggregate.std = (aggregate.sumSq / aggregate.count) - (aggregate.avg * aggregate.avg);

		if (duration < aggregate.min) aggregate.min = duration;
		if (duration > aggregate.max) aggregate.max = duration;

		this.emitEnd(block, aggregate);

		return this;
	}

	wrap(fn, id, warnDelay = DEFAULT_WARN_DELAY) {
		this.begin(id, warnDelay);
		fn();
		this.end(id);
	}

	emitBegin(block) {
		this.events.push(`begin '${block.name}'`);
		this.events.shift();
		this.emit('begin', block);
		Profiler.combined.emit('begin', this.namespace, block);
	}

	emitEnd(block, aggregate) {
		this.events.push(`end '${block.name}' (${block.duration})`);
		this.events.shift();
		this.emit('end', block, aggregate);
		Profiler.combined.emit('end', this.namespace, block, aggregate);
	}

	emitWarning(warning) {
		this.warnings.push(warning);
		this.events.shift();
		this.emit('warning', warning);
		Profiler.combined.emit('warning', this.namespace, warning);
	}

	getStats(name) {
		if (typeof name === 'number') name = this.activeBlocksById[name].name;
		if (name) return this.stats[name];
		return this.stats;
	}

	getEvents() {
		return this.events;
	}

	getWarnings() {
		return this.warnings;
	}

}

Profiler.combined = new EventEmitter();
Profiler.combined.getStats = () => stats;
Profiler.combined.getWarnings = () => warnings;

module.exports = Profiler;
