const _ = require('lodash');

class ProfilerBlock {
	constructor({ id, name, warnThreshold, profiler }) {
		_.extend(this, { id, name, warnThreshold, profiler });

		this.startedOn = new Date();
	}

	end() {
		return this.profiler.end(this);
	}

	wrappedEnd() {
		return this.profiler.wrappedEnd(this);
	}
}
module.exports = ProfilerBlock;
