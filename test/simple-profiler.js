const { expect } = require('chai');
const XError = require('xerror');
const Profiler = require('../lib');

describe.only('Profiler', function() {
	beforeEach(function() {
		Profiler.disable();
		Profiler.emitter.removeAllListeners();
	});

	it('should start disabled', function() {
		let profiler = new Profiler('disabled');

		let hasBegun = false;
		profiler.on('begin', () => { hasBegun = true; });

		let block = profiler.begin('will never run');

		expect(Profiler.isEnabled).to.be.false;
		expect(block).to.be.undefined;
		expect(hasBegun).to.be.false;
	});

	it('should support being enabled', function() {
		let profiler = new Profiler('disabled');

		let hasBegun = false;
		profiler.on('begin', () => { hasBegun = true; });

		Profiler.enable();

		let block = profiler.begin('will indeed run');

		expect(Profiler.isEnabled).to.be.true;
		expect(block).to.be.an('object');
		expect(hasBegun).to.be.true;
	});

	it('@enable', function() {
		Profiler.enable();
		expect(Profiler.isEnabled).to.be.true;
	});

	it('@disable', function() {
		Profiler.disable();
		expect(Profiler.isEnabled).to.be.false;
	});

	it('#begin should return a block', function() {
		Profiler.enable();

		let profiler = new Profiler('test');
		let block = profiler.begin('foo');

		expect(block).to.be.an('object');
		expect(block.id).to.be.a('number');
		expect(block.name).to.equal('foo');
		expect(block.startedOn).to.be.a('date');
		expect(block.end).to.be.a('function');
	});

	it('#begin should return a working `end` method', function() {
		Profiler.enable();

		let profiler = new Profiler('test');
		let block = profiler.begin('foo');
		let aggregate = block.end();

		expect(aggregate.count).to.equal(1);
	});

	it('#end should support `id`', function() {
		Profiler.enable();

		let profiler = new Profiler('test');
		let block = profiler.begin('foo');
		let aggregate = profiler.end(block.id);

		expect(aggregate.count).to.equal(1);
	});

	it('#end should support `name`', function() {
		Profiler.enable();

		let profiler = new Profiler('test');
		let block = profiler.begin('foo');
		let aggregate = profiler.end(block.name);

		expect(aggregate.count).to.equal(1);
	});

	it('#end should return the aggregate', function() {
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

	it('@emitter should emit ALREADY_EXISTS warning', function(done) {
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

	it('@constructor should emit ALREADY_EXISTS warning', function(done) {
		Profiler.enable();

		new Profiler('ALREADY_EXISTS-2'); // eslint-disable-line no-new
		let profiler2 = new Profiler('ALREADY_EXISTS-2');

		profiler2.on('warning', (warning) => {
			expect(warning).to.be.an.instanceof(XError);
			expect(warning.code).to.equal(XError.ALREADY_EXISTS);
			done();
		});
	});

	it('#end should emit LIMIT_EXCEEDED warning', function(done) {
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

	it('#wrap should wrap functions', function() {
		Profiler.enable();

		let profiler = new Profiler('wrapper\'s delight');

		let hasRan = false;
		profiler.wrap(() => hasRan = true, 'it\'s a wrap');

		expect(hasRan).to.be.true;
	});

	it('#wrap should wrap promises', function(done) {
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
