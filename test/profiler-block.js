// Copyright 2016 Zipscene, LLC
// Licensed under the Apache License, Version 2.0
// http://www.apache.org/licenses/LICENSE-2.0

const XError = require('xerror');
const _ = require('lodash');
const { expect } = require('chai');

const ProfilerBlock = require('../lib/profiler-block');

describe('ProfilerBlock', function() {
	describe('@constructor', function() {
		it('instantiates a ProfilerBlock with id, name, warnThreshold, and stats', function() {
			const id = 0;
			const name = 'foo';
			const stats = {};
			const warnThreshold = 100;
			const block = new ProfilerBlock(id, name, { stats, warnThreshold });

			expect(block.id).to.equal(0);
			expect(block.name).to.equal('foo');
			expect(block.warnThreshold).to.equal(100);
			expect(block.stats).to.equal(stats);
		});

		it('throws if not passed a stats object', function() {
			const id = 0;
			const name = 'foo';
			expect(() => new ProfilerBlock(id, name, {})).to.throw(XError.INTERNAL_ERROR);
		});
	});

	describe('#end', function() {
		it('sets `endedOn` and `duration`', function() {
			const id = 0;
			const name = 'foo';
			const stats = {};
			const block = new ProfilerBlock(id, name, { stats });
			block.end();
			expect(block.endedOn).not.to.be.undefined;
			expect(block.duration).not.to.be.undefined;
		});

		it('returns a stats object', function() {
			const id = 0;
			const name = 'foo';
			const stats = {};
			const block = new ProfilerBlock(id, name, { stats });
			const endStats = block.end();
			expect(endStats).to.equal(stats);
			expect(endStats.sum).to.be.a('number');
			expect(endStats.sumSq).to.be.a('number');
			expect(endStats.avg).to.be.a('number');
			expect(endStats.std).to.be.a('number');
			expect(endStats.min).to.be.a('number');
			expect(endStats.max).to.be.a('number');
		});

		it('warns on an iteration over the warnThreshold after 100 iterations', function() {
			const id = 0;
			const name = 'foo';
			const stats = {};
			const warnThreshold = 100;
			const block = new ProfilerBlock(id, name, { stats, warnThreshold });

			let hasWarned = false;
			block.on('warning', () => hasWarned = true);

			_.times(100, () => {
				const block = new ProfilerBlock(id, name, { stats, warnThreshold });
				block.end();
			});

			return new Promise((resolve) => setTimeout(() => {
				block.end();
				resolve();
			}, 100))
				.then(() => expect(hasWarned).to.be.true);
		});

		it('emits an "end" event', function() {
			const id = 0;
			const name = 'foo';
			const stats = {};
			const block = new ProfilerBlock(id, name, { stats });

			let hasEnded = false;
			block.on('end', () => hasEnded = true);

			block.end();
			expect(hasEnded).to.be.true;
		});
	});

	describe('#wrappedEnd', function() {
		it('returns a function that calls #end() and passes its argument through', function() {
			const id = 0;
			const name = 'foo';
			const stats = {};
			const block = new ProfilerBlock(id, name, { stats });
			const wrapped = block.wrappedEnd();

			let hasEnded = false;
			block.on('end', () => hasEnded = true);

			return Promise.resolve('foo')
				.then(wrapped)
				.then((res) => {
					expect(res).to.equal('foo');
					expect(hasEnded).to.be.true;
				});
		});
	});
});
