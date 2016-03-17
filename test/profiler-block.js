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
			const id = 0;
			const name = 'foo';
			const options = { warnThreshold: 100, profiler: this.profiler };
			const block = new ProfilerBlock(id, name, options);

			expect(block.id).to.equal(0);
			expect(block.name).to.equal('foo');
			expect(block.warnThreshold).to.equal(100);
			expect(block.profiler).to.equal(this.profiler);
		});

		it('throws if not passed a Profiler', function() {
			// TODO: manually throw a descriptive error
			const id = 0;
			const name = 'foo';
			expect(() => new ProfilerBlock(id, name, {})).to.throw();
		});

		it('uses an existing stats object from the Profiler', function() {
			const stats = {};
			this.profiler.stats['block-name'] = stats;

			const id = 0;
			const name = 'block-name';
			const options = { profiler: this.profiler };
			const block = new ProfilerBlock(id, name, options);

			expect(block.stats).to.equal(stats);
		});

		it('adds the ProfilerBlock to the Profiler unless isActive is passed and falsey', function() {
			const activeId = 0;
			const activeName = 'active';
			const activeOptions = { profiler: this.profiler };
			const activeBlock = new ProfilerBlock(activeId, activeName, activeOptions);

			const inactiveId = 1;
			const inactiveName = 'inactive';
			const inactiveOptions = { profiler: this.profiler, isActive: false };
			const inactiveBlock = new ProfilerBlock(inactiveId, inactiveName, inactiveOptions);

			expect(this.profiler.activeBlocksById[activeBlock.id]).to.equal(activeBlock);
			expect(this.profiler.activeBlocksByName[activeBlock.name]).to.equal(activeBlock);
			expect(this.profiler.activeBlocksById[inactiveBlock.id]).to.be.undefined;
			expect(this.profiler.activeBlocksByName[inactiveBlock.name]).to.be.undefined;
		});
	});

	describe('#end', function() {
		it('sets `endedOn` and `duration`', function() {
			const id = 0;
			const name = 'foo';
			const options = { profiler: this.profiler };
			const block = new ProfilerBlock(id, name, options);
			block.end();
			expect(block.endedOn).not.to.be.undefined;
			expect(block.duration).not.to.be.undefined;
		});

		it('returns a stats object', function() {
			const id = 0;
			const name = 'foo';
			const options = { profiler: this.profiler };
			const block = new ProfilerBlock(id, name, options);
			const stats = block.end();
			expect(stats.sum).to.be.a('number');
			expect(stats.sumSq).to.be.a('number');
			expect(stats.avg).to.be.a('number');
			expect(stats.std).to.be.a('number');
			expect(stats.min).to.be.a('number');
			expect(stats.max).to.be.a('number');
		});

		it('removes itself from the Profiler', function() {
			const id = 0;
			const name = 'foo';
			const options = { profiler: this.profiler };
			const block = new ProfilerBlock(id, name, options);
			block.end();
			expect(this.profiler.activeBlocksById[block.id]).to.be.undefined;
			expect(this.profiler.activeBlocksByName[block.name]).to.be.undefined;
		});

		it('warns on an iteration over the warnThreshold after 100 iterations', function() {
			const id = 0;
			const name = 'foo';
			const options = { warnThreshold: 100, profiler: this.profiler };
			const block = new ProfilerBlock(id, name, options);

			let hasWarned = false;
			this.profiler.on('warning', () => hasWarned = true);

			_.times(100, () => {
				const block = new ProfilerBlock(id, name, options);
				block.end();
			});

			return new Promise((resolve) => setTimeout(() => {
				block.end();
				resolve();
			}, 100))
				.then(() => expect(hasWarned).to.be.true);
		});

		it('calls Profiler#emitEnd()', function() {
			const id = 0;
			const name = 'foo';
			const options = { profiler: this.profiler };
			const block = new ProfilerBlock(id, name, options);

			let hasEnded = false;
			this.profiler.on('end', () => hasEnded = true);

			block.end();
			expect(hasEnded).to.be.true;
		});
	});

	describe('#wrappedEnd', function() {
		it('returns a function that calls #end() and passes its argument through', function() {
			const id = 0;
			const name = 'foo';
			const options = { profiler: this.profiler };
			const block = new ProfilerBlock(id, name, options);
			const wrapped = block.wrappedEnd();

			let hasEnded = false;
			this.profiler.on('end', () => hasEnded = true);

			return Promise.resolve('foo')
				.then(wrapped)
				.then((res) => {
					expect(res).to.equal('foo');
					expect(hasEnded).to.be.true;
				});
		});
	});
});
