const _ = require('lodash');
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
			this.profiler.stats['block-name'] = stats;

			let options = {
				name: 'block-name',
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

			expect(this.profiler.activeBlocksById[activeBlock.id]).to.equal(activeBlock);
			expect(this.profiler.activeBlocksByName[activeBlock.name]).to.equal(activeBlock);
			expect(this.profiler.activeBlocksById[inactiveBlock.id]).to.be.undefined;
			expect(this.profiler.activeBlocksByName[inactiveBlock.name]).to.be.undefined;
		});
	});

	describe('#end', function() {
		it('sets `endedOn` and `duration`', function() {
			let options = { profiler: this.profiler };
			let block = new ProfilerBlock(options);
			block.end();
			expect(block.endedOn).not.to.be.undefined;
			expect(block.duration).not.to.be.undefined;
		});

		it('returns a stats object', function() {
			let options = { profiler: this.profiler };
			let block = new ProfilerBlock(options);
			let stats = block.end();
			expect(stats.sum).to.be.a('number');
			expect(stats.sumSq).to.be.a('number');
			expect(stats.avg).to.be.a('number');
			expect(stats.std).to.be.a('number');
			expect(stats.min).to.be.a('number');
			expect(stats.max).to.be.a('number');
		});

		it('removes itself from the Profiler', function() {
			let options = { profiler: this.profiler };
			let block = new ProfilerBlock(options);
			block.end();
			expect(this.profiler.activeBlocksById[block.id]).to.be.undefined;
			expect(this.profiler.activeBlocksByName[block.name]).to.be.undefined;
		});

		it('warns on an iteration over the warnThreshold after 100 iterations', function() {
			let hasWarned = false;
			this.profiler.on('warning', () => hasWarned = true);

			let options = {
				warnThreshold: 100,
				profiler: this.profiler
			};
			_.times(100, () => {
				let block = new ProfilerBlock(options);
				block.end();
			});

			let block = new ProfilerBlock(options);
			return new Promise((resolve) => {
				setTimeout(() => {
					block.end();
					resolve();
				}, 100);
			})
				.then(() => expect(hasWarned).to.be.true);
		});

		it('calls Profiler#emitEnd()', function() {
			let hasEnded = false;
			this.profiler.on('end', () => hasEnded = true);

			let options = { profiler: this.profiler };
			let block = new ProfilerBlock(options);
			block.end();
			expect(hasEnded).to.be.true;
		});
	});

	describe('#wrappedEnd', function() {
		it('returns a function that calls #end() and passes its argument through', function() {
			let hasEnded = false;
			this.profiler.on('end', () => hasEnded = true);

			let options = { profiler: this.profiler };
			let block = new ProfilerBlock(options);
			let wrapped = block.wrappedEnd();

			return Promise.resolve('foo')
				.then(wrapped)
				.then((res) => {
					expect(res).to.equal('foo');
					expect(hasEnded).to.be.true;
				});
		});
	});
});
