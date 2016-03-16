const { expect } = require('chai');

describe('ProfilerBlock', function() {
	describe('@constructor', function() {
		it('instantiates a ProfilerBlock with id, name, warnThreshold, and profiler', function() {
		});

		it('throws if not passed a Profiler', function() {
		});

		it('uses an existing stats object from the Profiler', function() {
		});

		it('adds the ProfilerBlock to the Profiler if isActive is passed and falsey', function() {
		});
	});

	describe('#end', function() {
		it('sets `endedOn` and `duration`', function() {
		});

		it('returns a stats object', function() {
		});

		it('removes itself from the Profiler', function() {
		});

		it('warns on an iteration over the warnThreshold after 100 iterations', function() {
		});

		it('calls Profiler#emitEnd()', function() {
		});
	});

	describe('#wrappedEnd', function() {
		it('returns a function that calls #end() and passes its argument through', function() {
		});
	});
});
