import { NumericModes } from '#shared/terms.js'

export function makeChartBtnMenu(holder, chartsInstance) {
	/*
	holder: the holder in the tooltip
	chartsInstance: MassCharts instance
		termdbConfig is accessible at chartsInstance.state.termdbConfig{}
		mass option is accessible at chartsInstance.app.opts{}
	*/
	chartsInstance.dom.tip.clear()
	const menuDiv = holder.append('div')
	if (chartsInstance.state.termdbConfig.numericDictTermCluster?.plots) {
		for (const plot of chartsInstance.state.termdbConfig.numericDictTermCluster.plots) {
			/* plot: 
			{
				name=str
			}
			*/
			menuDiv
				.append('button')
				.style('margin', '10px')
				.style('padding', '10px 15px')
				.style('border-radius', '20px')
				.style('border-color', '#ededed')
				.style('display', 'inline-block')
				.text(plot.name)
				.on('click', async () => {
					chartsInstance.dom.tip.hide()
					const config = await chartsInstance.app.vocabApi.getNumericDictTermClusterByName(plot.name)
					//add pre-built plot name to config to be shown in the sandbox header
					config.preBuiltPlotTitle = plot.name
					chartsInstance.app.dispatch({
						type: 'plot_create',
						config
					})
				})
		}
	}

	const chart = {
		//use the app name defined in dataset file
		label: chartsInstance.state.termdbConfig.numericDictTermCluster?.appName || 'Numeric Dictionary Term cluster',
		chartType: 'numericDictTermCluster',
		clickTo: self.showTree_selectlst,
		usecase: {
			target: 'numericDictTermCluster',
			detail: { exclude: chartsInstance.state.termdbConfig.numericDictTermCluster?.exclude }
		},
		updateActionBySelectedTerms: (action, termlst) => {
			const twlst = termlst.map(term => ({
				term: structuredClone(term),
				q: { mode: NumericModes.continuous }
			}))
			if (twlst.length == 1) {
				// violin
				action.config.chartType = 'summary'
				action.config.term = twlst[0]
				return
			}
			if (twlst.length == 2) {
				// scatter
				action.config.chartType = 'summary'
				action.config.term = twlst[0]
				action.config.term2 = twlst[1]
				return
			}
			// 3 or more terms, launch clustering
			action.config.chartType = 'hierCluster'
			action.config.dataType = 'numericDictTerm'
			action.config.termgroups = [
				{
					name:
						chartsInstance.state.termdbConfig.numericDictTermCluster?.settings?.termGroupName ||
						'Numercic Dictionary Term Cluster',
					lst: twlst,
					type: 'hierCluster'
				}
			]
		}
	}
	chartsInstance.showTree_selectlst(chart)
}
