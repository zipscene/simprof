const { expect } = require('chai');
const XError = require('xerror');
const Profiler = require('../lib');
const ProfilerBlock = require('../lib/profiler-block');

describe('Profiler', function() {
	beforeEach(function() {
		Profiler.disable();
		Profiler.emitter.removeAllListeners();
	});

	describe('@enable', function() {
		it('globally enables Profiler', function() {
			Profiler.enable();
			expect(Profiler.isEnabled()).to.be.true;
		});

		it('enables Profiler instances', function() {
			let profiler = new Profiler('disabled');

			let hasBegun = false;
			profiler.on('begin', () => { hasBegun = true; });

			Profiler.enable();

			profiler.begin('will indeed run');

			expect(Profiler.isEnabled()).to.be.true;
			expect(hasBegun).to.be.true;
		});
	});

	describe('@disable', function() {
		it('globally disables Profiler', function() {
			Profiler.disable();
			expect(Profiler.isEnabled()).to.be.false;
		});

		it('disables Profiler instances', function() {
			Profiler.enable();

			let profiler = new Profiler('enabled');

			let hasBegun = false;
			profiler.on('begin', () => { hasBegun = true; });

			Profiler.disable();

			profiler.begin('will never run');

			expect(Profiler.isEnabled()).to.be.false;
			expect(hasBegun).to.be.false;
		});
	});

	describe('@emitter', function() {
		it('should emit ALREADY_EXISTS warning', function(done) {
			Profiler.enable();

			const profilerKey = 'ALREADY_EXISTS-1';

			Profiler.emitter.on('warning', (namespace, warning) => {
				expect(namespace).to.equal(profilerKey);
				expect(warning).to.be.an.instanceof(XError);
				expect(warning.code).to.equal(XError.ALREADY_EXISTS);
				done();
			});

			new Profiler(profilerKey); // eslint-disable-line no-new
			new Profiler(profilerKey); // eslint-disable-line no-new
		});
	});

	describe('@constructor', function() {
		it('should emit ALREADY_EXISTS warning', function(done) {
			Profiler.enable();

			new Profiler('ALREADY_EXISTS-2'); // eslint-disable-line no-new
			let profiler2 = new Profiler('ALREADY_EXISTS-2');

			profiler2.on('warning', (warning) => {
				expect(warning).to.be.an.instanceof(XError);
				expect(warning.code).to.equal(XError.ALREADY_EXISTS);
				done();
			});
		});

		it('should start disabled', function() {
			let profiler = new Profiler('disabled');

			let hasBegun = false;
			profiler.on('begin', () => { hasBegun = true; });

			let block = profiler.begin('will never run');

			expect(Profiler.isEnabled()).to.be.false;
			expect(block).to.equal(profiler.disabledBlock);
			expect(hasBegun).to.be.false;
		});
	});

	describe('#getBlock', function() {
		it('gets a block w/ id', function() {
			Profiler.enable();
			let profiler = new Profiler('test');
			let { id } = profiler.begin('foo');
			expect(profiler.getBlock(id)).to.be.an.instanceof(ProfilerBlock);
		});

		it('gets a block w/ name', function() {
			Profiler.enable();
			let profiler = new Profiler('test');
			let { name } = profiler.begin('foo');
			expect(profiler.getBlock(name)).to.be.an.instanceof(ProfilerBlock);
		});

		it('passes through a block', function() {
			Profiler.enable();
			let profiler = new Profiler('test');
			let block = profiler.begin('foo');
			expect(profiler.getBlock(block)).to.be.an.instanceof(ProfilerBlock);
		});

		it('throws if called w/ invalid input', function() {
			Profiler.enable();
			let profiler = new Profiler('test');
			expect(() => profiler.getBlock(0)).to.throw(XError.INTERNAL_ERROR);
			expect(() => profiler.getBlock('foo')).to.throw(XError.INTERNAL_ERROR);
			expect(() => profiler.getBlock({})).to.throw(XError.INTERNAL_ERROR);
		});
	});

	describe('#begin', function() {
		it('#begin should return a block', function() {
			Profiler.enable();

			let profiler = new Profiler('test');
			let block = profiler.begin('foo');
			expect(block).to.be.an.instanceof(ProfilerBlock);
		});

		it('should emit \'begin\'', function() {
			Profiler.enable();

			let profiler = new Profiler('test');

			let hasBegun = false;
			profiler.on('begin', () => hasBegun = true);

			profiler.begin('foo');

			expect(hasBegun).to.be.true;
		});
	});

	describe('#end', function() {
		it('should return the aggregate', function() {
			Profiler.enable();

			let profiler = new Profiler('test');
			let block = profiler.begin('foo');
			let aggregate = block.end();

			expect(aggregate.count).to.be.a('number');
			expect(aggregate.sum).to.be.a('number');
			expect(aggregate.sumSq).to.be.a('number');
			expect(aggregate.avg).to.be.a('number');
			expect(aggregate.std).to.be.a('number');
			expect(aggregate.min).to.be.a('number');
			expect(aggregate.max).to.be.a('number');
		});

		it('should emit LIMIT_EXCEEDED warning', function(done) {
			Profiler.enable();

			let profiler = new Profiler('LIMIT_EXCEEDED');

			for (let n = 0; n < 100; n++) {
				let block = profiler.begin('foo');
				block.end();
			}

			let block = profiler.begin('foo');
			setTimeout(() => block.end(), 10);

			profiler.on('warning', (warning) => {
				expect(warning).to.be.an.instanceof(XError);
				expect(warning.code).to.equal(XError.LIMIT_EXCEEDED);
				done();
			});
		});

		it('should support `name`', function() {
			Profiler.enable();

			let profiler = new Profiler('test');
			let block = profiler.begin('foo');
			let aggregate = profiler.end(block.name);

			expect(aggregate.count).to.equal(1);
		});

		it('should support `id`', function() {
			Profiler.enable();

			let profiler = new Profiler('test');
			let block = profiler.begin('foo');
			let aggregate = profiler.end(block.id);

			expect(aggregate.count).to.equal(1);
		});
	});

	describe('#wrap', function() {
		it('should wrap functions', function() {
			Profiler.enable();

			let profiler = new Profiler('wrapper\'s delight');

			let hasRan = false;
			profiler.wrap(() => hasRan = true, 'it\'s a wrap');

			expect(hasRan).to.be.true;
		});

		it('should wrap promises', function(done) {
			Profiler.enable();

			let profiler = new Profiler('wrapper\'s delight');

			let hasRan = false;
			let iPromise = new Promise((resolve) => {
				hasRan = true;
				resolve();
			})
				.then(() => {
					expect(hasRan).to.be.true;
				})
				.then(() => done());

			profiler.wrap(iPromise, 'it\'s a wrap');
		});
	});
});
