# simprof

A simple code profiler.

## Basic usage

```javascript
const Profiler = require('simprof');

Profiler.enable();
const profiler = new Profiler('Foo');

let prof = profiler.begin('bar');
// ...
// Do stuff
// ...
prof.end();
```

## Getting the results

To get a dump of the profiler results, send `SIGUSR2` to the relevant node process:

```sh
kill -s USR2 31337
```

Note that the profiler starts disabled.
In addition to explicitly enabling it with `Profiler.enable()`,
it will be enabled by sending the `USR2` signal to it.

This means that you can get a dump from a disabled profiler by sending the process `USR2` twice.

## Advanced usage

```javascript
const Profiler = require('simprof');

// Create a new profiler instance, often one per file.
const profiler = new Profiler('Whatever');

class Whatever {

	vanilla() {
		// Create a named profiler block
		// NOTE: There is no magic syntax here,
		// `#vanilla` is just a common way to refer to an instance method.
		let prof = profiler.begin('#vanilla');

		// DO ALL THE THINGS
		this.do();
		all();
		the();
		this.things();

		// End the profiler block
		prof.end();
	}

	nested() {
		// You can have nested profiler blocks,
		// which is helpful for HUGE MONOLITHIC FUNCTIONS and whatnot.
		// NOTE: Again, no magic syntax here, just human-readable names.
		let prof = profiler.begin('#nested');

		let profFoo = profiler.begin('#nested foo');
		let foo = this.foo();
		foo.blah();
		profFoo.end();

		let profBar = profiler.begin('#nested bar');
		let bar = this.bar();
		bar.blah();
		profBar.end();

		let profBaz = profiler.begin('#nested baz');
		let baz = this.baz();
		baz.blah();
		profBaz.end();

		prof.end();
	}

	async wrapAndRun() {
		// This wraps and immediately runs the given function
		return await profiler.run('#wrapAndRun()', async() => {
			// Do stuff
		});
	}

	profileSequenceOfSteps() {
		// This allows a sequence of steps within an overall function to be individually profiled
		let profseq = profiler.sequence('#profileSequenceOfSteps');
		profseq.step('step1');
		// do stuff
		profseq.step('step2');
		// do stuff
		profseq.step('step3');
		// do stuff
		profseq.end();
	}

}
```
