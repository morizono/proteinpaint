import tape from 'tape'
import * as helpers from '../../test/front.helpers.js'
import { sleep, detectLst, detectOne, detectGte, whenVisible } from '../../test/test.helpers.js'

/*
tests:
	default hidden tabs, no filter
	chart buttons
	filter subheader and tab
	with_cohortHtmlSelect
*/

async function addDemographicSexFilter(opts, btn) {
	btn.click()
	const tipd = opts.filter.Inner.dom.treeTip.d.node()

	const termdiv1 = await detectLst({ elem: tipd, selector: '.termdiv', matchAs: '>=' })
	const demoPill = termdiv1.find(elem => elem.__data__.id === 'Demographic Variables')
	demoPill.querySelectorAll('.termbtn')[0].click()

	const termdivSex = await detectLst({ elem: tipd, selector: '.termdiv', count: 6, matchAs: '>=' })
	const sexPill = termdivSex.find(elem => elem.__data__.id === 'sex')
	sexPill.querySelectorAll('.termlabel')[0].click()
	const detectSelect = await detectLst({ elem: tipd, selector: "input[type='checkbox']", count: 1, matchAs: '>=' }) //; console.log(32, detectSelect); throw 'test'
	detectSelect[1].click()
	const applyBtn = await detectOne({ elem: tipd, selector: '.sjpp_apply_btn' })
	applyBtn.click()
}

/**************
 test sections
***************/
tape('\n', function (test) {
	test.pass('-***- mass/nav -***-')
	test.end()
})

tape('default hidden tabs, no filter', function (test) {
	test.timeoutAfter(3000)
	test.plan(4)
	runpp({
		state: {
			header_mode: 'search_only'
		},
		nav: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})
	function runTests(nav) {
		nav.on('postRender.test', null)
		test.equal(nav.Inner.dom.tabDiv.style('display'), 'none', 'should hide the tabs by default')
		test.equal(nav.Inner.dom.holder.style('margin-bottom'), '0px', 'should not set a margin-bottom')
		test.equal(nav.Inner.dom.holder.style('border-bottom'), '0px none rgb(0, 0, 0)', 'should not show a border-bottom')
		test.notEqual(nav.Inner.dom.searchDiv.style('display'), 'none', 'should show the search input')
		// TODO: should make subheader display none?
		//test.equal(nav.Inner.dom.subheaderDiv.style('display'), 'none', 'should hide the subheader')
		if (test._ok) nav.Inner.app.destroy()
		test.end()
	}
})

tape('chart buttons', function (test) {
	test.timeoutAfter(3000)
	runpp({
		state: {
			activeCohort: 0,
			nav: {
				header_mode: 'with_tabs'
			}
		},
		nav: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})
	async function runTests(nav) {
		for (const btn of nav.Inner.components.charts.Inner.dom.btns._groups[0]) {
			// btn is native dom element, not d3-wrapped
			if (btn.style.display == 'none') {
				// hidden button means the chart is not supported in termdbtest
				continue
			}
			/* chart button is visible
			evaluate what happens after clicking it, based on the innerHTML of each button;
			if a chart name is customized in termdbtest, the test must be updated here

			must not trigger click before all if(), this will cause all previous temporary menu items to disappear
			*/
			switch (btn.innerHTML) {
				case 'Data Dictionary':
					btn.dispatchEvent(new Event('click'))
					await detectOne({
						elem: nav.Inner.app.Inner.dom.plotDiv.node(),
						selector: '[data-testid=sjpp-massplot-sandbox-dictionary]'
					})
					test.pass('found sandbox after clicking chart button: ' + btn.innerHTML)
					break
				case 'Sample View':
					btn.dispatchEvent(new Event('click'))
					await detectOne({
						elem: nav.Inner.app.Inner.dom.plotDiv.node(),
						selector: '[data-testid=sjpp-massplot-sandbox-sampleView]'
					})
					test.pass('found sandbox after clicking chart button: ' + btn.innerHTML)
					break
				case 'Data Download':
					btn.dispatchEvent(new Event('click'))
					await detectOne({
						elem: nav.Inner.app.Inner.dom.plotDiv.node(),
						selector: '[data-testid=sjpp-massplot-sandbox-dataDownload]'
					})
					test.pass('found sandbox after clicking chart button: ' + btn.innerHTML)
					break
				case 'Summary Plots':
				case 'Scatter Plot':
				case 'Cumulative Incidence':
				case 'Survival':
				case 'Regression Analysis':
				case 'Sample Matrix':
				case 'Genome Browser':
				case 'Facet Table':
				case 'Gene Expression':
					btn.dispatchEvent(new Event('click'))
					await whenVisible(nav.Inner.components.charts.Inner.dom.tip.d.node())
					test.pass('charts.dom.tip is shown after clicking chart button: ' + btn.innerHTML)
					nav.Inner.components.charts.Inner.dom.tip.hide()
					break
				default:
					test.fail('TODO: need test cover for chart button', btn.innerHTML)
			}
		}
		if (test._ok) nav.Inner.app.destroy()
		test.end()
	}
})

tape('filter subheader and tab', function (test) {
	test.timeoutAfter(3000)
	runpp({
		state: {
			activeCohort: 0,
			nav: {
				header_mode: 'with_tabs'
			}
		},
		nav: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	let tds, trs
	function runTests(nav) {
		nav.on('postRender.test', null)
		tds = nav.Inner.dom.tabDiv.selectAll('td')
		trs = nav.Inner.dom.tabDiv.node().querySelectorAll('tr')
		helpers
			.rideInit({ arg: nav, bus: nav, eventType: 'postRender.test' })
			.use(triggerTabSwitch)
			.to(testTabSwitch, 100)
			.use(triggerFilterAdd)
			.to(testFilterAdd, 100)
			.done(test)
	}

	function triggerTabSwitch(nav) {
		tds
			.filter((d, i) => i === 3)
			.node()
			.click()
	}

	function testTabSwitch(nav) {
		test.notEqual(
			nav.Inner.dom.subheaderDiv.style('display'),
			'none',
			'should show the subheader when the filter tab is clicked'
		)
	}

	async function triggerFilterAdd(nav) {
		const newBtn = nav.Inner.dom.subheader.filter.node().querySelector('.sja_new_filter_btn')

		await addDemographicSexFilter({ filter: nav.getComponents('filter') }, newBtn)
	}

	function testFilterAdd(nav) {
		test.equal(
			nav.Inner.dom.subheader.filter.node().querySelectorAll('.sja_pill_wrapper').length,
			1,
			'should add blue pill'
		)
		const itemCountTd = tds._groups[0][7]
		test.equal(itemCountTd.innerText, '1', 'should indicate a filter item count of 1')

		const sampleCountTd = tds._groups[0][11]
		const n = 36
		test.equal(sampleCountTd.innerText, `${n} patients`, 'should display the correct filtered sample count')
	}
})

// TODO: create a test dataset without a cohort
// tape.only('no termd.selectCohort', function(test) {
// 	test.timeoutAfter(3000)

// 	runpp({
// 		state: {
// 			genome: 'hg38-test',
// 			dslabel: 'NoCohortSJLife',
// 			activeCohort: -1,
// 			nav: {
// 				header_mode: 'with_tabs'
// 			}
// 		},

// 		nav: {
// 			callbacks: {
// 				'postRender.test': runTests
// 			}
// 		}
// 	})

// 	let tds, trs
// 	function runTests(nav) {
// 		tds = nav.Inner.dom.tabDiv.selectAll('td')
// 		trs = nav.Inner.dom.tabDiv.node().querySelectorAll('tr')
// 		helpers
// 			.rideInit({ arg: nav, bus: nav, eventType: 'postRender.test' })
// 			.run(testPreCohortSelection)
// 			.done(test)
// 	}

// 	function testPreCohortSelection(nav) {
// 		test.equal(
// 			tds
// 				.filter(function() {
// 					return this.style.display !== 'none'
// 				})
// 				.size() / trs.length,
// 			2,
// 			'should show 2 tabs'
// 		)
// 		test.equal(
// 			tds
// 				.filter(function(d) {
// 					return d.colNum === 0 && this.style.display === 'none'
// 				})
// 				.size() / trs.length,
// 			1,
// 			'should not show the cohort tab'
// 		)
// 	}
// })

tape('with_cohortHtmlSelect', function (test) {
	runpp({
		state: {
			nav: { header_mode: 'with_cohortHtmlSelect' }
		},
		nav: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})
	function runTests(nav) {
		nav.on('postRender.test', null)
		test.equal(nav.Inner.dom.tabDiv.style('display'), 'none', 'should hide the tabs by default')
		test.equal(nav.Inner.dom.holder.style('margin-bottom'), '0px', 'should not set a margin-bottom')
		test.equal(nav.Inner.dom.holder.style('border-bottom'), '0px none rgb(0, 0, 0)', 'should not show a border-bottom')
		test.notEqual(nav.Inner.dom.searchDiv.style('display'), 'none', 'should show the search input')
		test.true(nav.Inner.dom.cohortSelect != undefined, 'should show a cohort select element')
		if (test._ok) nav.Inner.app.destroy()
		test.end()
	}
})

// TODO: create a test dataset without a cohort
// tape('with_cohortHtmlSelect + missing ds.termdbConfig.selectCohort', function(test) {
// 	runpp({
// 		state: {
// 			genome: 'hg38',
// 			dslabel: 'NoCohortSJLife',
// 			activeCohort: 0,
// 			nav: {
// 				header_mode: 'with_cohortHtmlSelect'
// 			}
// 		},
// 		opts: {
// 			nav: {
// 				callbacks: {
// 					'postInit.test': runTests
// 				}
// 			}
// 		}
// 	})
// 	function runTests(nav) {
// 		test.equal(nav.Inner.dom.tabDiv.style('display'), 'none', 'should hide the tabs by default')
// 		test.equal(nav.Inner.dom.holder.style('margin-bottom'), '0px', 'should not set a margin-bottom')
// 		test.equal(nav.Inner.dom.holder.style('border-bottom'), '0px none rgb(0, 0, 0)', 'should not show a border-bottom')
// 		test.notEqual(nav.Inner.dom.searchDiv.style('display'), 'none', 'should show the search input')
// 		test.true(nav.Inner.dom.cohortSelect == undefined, 'should not show a cohort select element')
// 		test.end()
// 	}
// })

/*************************
 reusable helper functions
**************************/

const runpp = helpers.getRunPp('mass', {
	state: {
		dslabel: 'TermdbTest',
		genome: 'hg38-test',
		nav: {
			header_mode: 'search_only'
		}
	},
	debug: 1
})
