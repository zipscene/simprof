// Copyright 2016 Zipscene, LLC
// Licensed under the Apache License, Version 2.0
// http://www.apache.org/licenses/LICENSE-2.0

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

	describe('@constructor', function() {
		it('should reuse existing namespaces', function() {
			Profiler.enable();

			let profiler1 = new Profiler('ALREADY_EXISTS');
			let profiler2 = new Profiler('ALREADY_EXISTS');

			expect(profiler1).to.equal(profiler2);
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

		it('handles invalid input', function() {
			Profiler.enable();
			let profiler = new Profiler('invalid-input');
			expect(profiler.getBlock(0)).to.equal(null);
			expect(profiler.getBlock('foo')).to.equal(null);
			expect(() => profiler.getBlock({})).to.throw(XError);
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
			profiler.on('begin', () => { hasBegun = true; });

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

			let profiler = new Profiler('something-unique');
			let block = profiler.begin('foo');
			let aggregate = profiler.end(block.name);

			expect(aggregate.count).to.equal(1);
		});

		it('should support `id`', function() {
			Profiler.enable();

			let profiler = new Profiler('something-more-unique');
			let block = profiler.begin('foo');
			let aggregate = profiler.end(block.id);

			expect(aggregate.count).to.equal(1);
		});
	});

	describe('#wrap', function() {
		it('should wrap synchronous functions', function() {
			Profiler.enable();
			let profiler = new Profiler('wrapper\'s delight');
			let fnObj = {
				fn(arg1, arg2) {
					expect(this).to.equal(fnObj);
					return arg1 + arg2;
				}
			};
			fnObj.fn = profiler.wrap(fnObj.fn, 'foo');
			let result = fnObj.fn(3, 4);
			expect(result).to.equal(7);
		});

		it('should wrap asynchronous functions', function() {
			Profiler.enable();
			let profiler = new Profiler('wrapper\'s delight');
			let fnObj = {
				fn(arg1, arg2) {
					expect(this).to.equal(fnObj);
					return new Promise((resolve) => {
						setTimeout(() => {
							resolve(arg1 + arg2);
						}, 10);
					});
				}
			};
			fnObj.fn = profiler.wrap(fnObj.fn, 'foo');
			return fnObj.fn(3, 4).then((result) => {
				expect(result).to.equal(7);
			});
		});

		it('should wrap a promise', function() {
			let ran = false;
			Profiler.enable();
			let profiler = new Profiler('wrapper\'s delight');
			let promise = new Promise((resolve) => setTimeout(() => {
				ran = true;
				resolve();
			}, 10));
			return profiler.wrap(promise, 'foo').then(() => {
				expect(ran).to.equal(true);
			});
		});

		it('should return a scalar', function() {
			Profiler.enable();
			let profiler = new Profiler('wrapper\'s delight');
			let result = profiler.wrap(123, 'foo');
			expect(result).to.equal(123);
		});
	});
});
