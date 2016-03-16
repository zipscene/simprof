const XError = require('xerror');
const _ = require('lodash');

class ProfilerBlock {
	constructor({ id, name, warnThreshold, profiler, isActive = true }) {
		_.extend(this, { id, name, warnThreshold, profiler });

		this.startedOn = new Date();
		this.stats = (_.isUndefined(profiler.stats[name])) ? {} : profiler.stats[name];
		_.defaults(this.stats, {
			count: 0,
			sum: 0,
			sumSq: 0,
			avg: 0,
			std: 0,
			min: Infinity,
			max: -Infinity
		});
		profiler.stats[name] = this.stats;

		if (isActive) profiler.addBlock(this);
	}

	end() {
		const { profiler } = this;
		profiler.removeBlock(this);

		this.endedOn = new Date();
		this.duration = this.endedOn - this.startedOn;

		this.updateStats();

		let { warnThreshold } = this;
		if (typeof warnThreshold !== 'number') warnThreshold = 2 * this.stats.avg + this.stats.std;
		if (this.stats.count >= 100 && this.duration > warnThreshold) {
			let warnMessage = `Block ${this.name} took longer than the acceptable threshold.`;
			profiler.emitWarning(new XError(XError.LIMIT_EXCEEDED, warnMessage));
		}

		profiler.emitEnd(this);

		return this.stats;
	}

	updateStats() {
		const { duration, stats } = this;
		stats.count += 1;
		stats.sum += this.duration;
		stats.sumSq += this.duration * this.duration;
		stats.avg = stats.sum / stats.count;
		stats.std = (stats.sumSq / stats.count) - (stats.avg * stats.avg);
		if (duration < stats.min) stats.min = duration;
		if (duration > stats.max) stats.max = duration;
		return stats;
	}

	wrappedEnd() {
		return (param) => {
			this.end();
			return param;
		};
	}
}
module.exports = ProfilerBlock;
