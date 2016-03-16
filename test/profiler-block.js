const { expect } = require('chai');
const ProfilerBlock = require('../lib/profiler-block');
const Profiler = require('../lib');

describe('ProfilerBlock', function() {
	before(function() {
		this.profiler = new Profiler('foo');
	});

	describe('@constructor', function() {
		it('instantiates a ProfilerBlock with id, name, warnThreshold, and profiler', function() {
			let options = {
				id: 0,
				name: 'foo',
				warnThreshold: 100,
				profiler: this.profiler
			};
			let block = new ProfilerBlock(options);

			expect(block.id).to.equal(0);
			expect(block.name).to.equal('foo');
			expect(block.warnThreshold).to.equal(100);
			expect(block.profiler).to.equal(this.profiler);
		});

		it('throws if not passed a Profiler', function() {
			// TODO: manually throw a descriptive error
			expect(() => new ProfilerBlock()).to.throw();
		});

		it('uses an existing stats object from the Profiler', function() {
			let stats = {};
			this.profiler.stats.stats = stats;

			let options = {
				id: 1,
				name: 'stats',
				profiler: this.profiler
			};
			let block = new ProfilerBlock(options);

			expect(block.stats).to.equal(stats);
		});

		it('adds the ProfilerBlock to the Profiler unless isActive is passed and falsey', function() {
			let activeOptions = {
				id: 2,
				name: 'active',
				profiler: this.profiler
			};
			let activeBlock = new ProfilerBlock(activeOptions);

			let inactiveOptions = {
				id: 3,
				name: 'inactive',
				profiler: this.profiler,
				isActive: false
			};
			let inactiveBlock = new ProfilerBlock(inactiveOptions);

			expect(this.profiler.activeBlocksByName[activeBlock.name]).to.equal(activeBlock);
			expect(this.profiler.activeBlocksByName[inactiveBlock.name]).to.be.undefined;
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
