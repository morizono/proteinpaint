import { MainPlotDiv } from '../../../types/hic.ts'
import { axisstyle, font } from '#src/client'
import { axisRight, axisBottom } from 'd3-axis'
import { scaleLinear } from 'd3-scale'
import { format as d3format } from 'd3-format'
import { select as d3select, pointer, Selection } from 'd3-selection'
import { Dom } from '../../../types/d3'

export class ChrPairView {
	/** opts */
	app: any
	hic: any
	plotDiv: MainPlotDiv
	parent: any
	data: any

	chrxlen: number
	chrylen: number
	maxchrlen: number
	canvas: Selection<HTMLCanvasElement, any, any, any>
	ctx: any

	resolution: number | null = null
	binpx = 1
	/** padding on the ends of x/y chr coordinate axes */
	axispad = 10

	constructor(opts) {
		this.app = opts.app
		this.hic = opts.hic
		this.plotDiv = opts.plotDiv
		this.data = opts.data
		this.parent = opts.parent
		this.chrxlen = this.hic.genome.chrlookup[this.parent.state.x.chr.toUpperCase()].len
		this.chrylen = this.hic.genome.chrlookup[this.parent.state.x.chr.toUpperCase()].len
		this.maxchrlen = Math.max(this.chrxlen, this.chrylen)
		this.canvas = this.plotDiv.plot.append('canvas')
	}

	setResolution() {
		//TODO: this is repeat code in view. Move to data mapper?
		/*
		for resolution bin from great to tiny
		find one that just shows >200 # bins over biggest chr
		*/
		for (let i = 0; i < this.hic.bpresolution.length; i++) {
			const res = this.hic.bpresolution[i]
			if (this.maxchrlen / res > 200) {
				this.resolution = res
				break
			}
		}
		if (this.resolution == null) {
			this.parent.error('no suitable resolution')
			return
		}
	}

	setDefaultBinpx() {
		if (this.resolution == null) return
		//this.binpx default is 1
		while ((this.binpx * this.maxchrlen) / this.resolution < 600) {
			this.binpx++
		}
	}

	renderAxes() {
		if (this.resolution == null) return

		//y axis
		const svgY = this.plotDiv.yAxis.append('svg')
		const h = Math.ceil(this.chrylen / this.resolution) * this.binpx
		svgY.attr('width', 100).attr('height', this.axispad * 2 + h)

		svgY
			.append('g')
			.attr('transform', 'translate(80,' + (this.axispad + h / 2) + ')')
			.append('text')
			.text(this.parent.state.y.chr)
			.attr('text-anchor', 'middle')
			.attr('font-size', 15)
			.attr('font-family', font)
			.attr('dominant-baseline', 'central')
			.attr('transform', 'rotate(90)')
		axisstyle({
			axis: svgY
				.append('g')
				.attr('transform', `translate(1, ${this.axispad})`)
				.call(axisRight(scaleLinear().domain([0, this.chrylen]).range([0, h])).tickFormat(d3format('.2s'))),
			showline: true
		})

		// x axis
		this.plotDiv.xAxis.selectAll('*').remove()
		const svgX = this.plotDiv.xAxis.append('svg')
		const w = Math.ceil(this.chrxlen / this.resolution) * this.binpx
		svgX.attr('height', 100).attr('width', this.axispad * 2 + w)
		svgX
			.append('text')
			.text(this.parent.state.x.chr)
			.attr('font-size', 15)
			.attr('font-family', font)
			.attr('x', this.axispad + w / 2)
			.attr('text-anchor', 'middle')
			.attr('y', 60)
		axisstyle({
			axis: svgX
				.append('g')
				.attr('transform', 'translate(' + this.axispad + ',1)')
				.call(axisBottom(scaleLinear().domain([0, this.chrxlen]).range([0, w])).tickFormat(d3format('.2s'))),
			showline: true
		})
	}

	renderCanvas() {
		this.canvas.style('margin', this.axispad + 'px').on('click', async function (this: any, event: MouseEvent) {
			const [x, y] = pointer(event, this)
			const [xObj, yObj] = this.parent.setPositions(x, y, this.binpx)
			this.app.dispatch({
				type: 'view_change',
				view: 'detail',
				config: {
					x: xObj,
					y: yObj
				}
			})
		})

		this.canvas['width'] = Math.ceil(this.chrxlen / this.resolution!) * this.binpx
		this.canvas['height'] = Math.ceil(this.chrylen / this.resolution!) * this.binpx
		this.ctx = this.canvas.node()!.getContext('2d')
	}

	getData() {
		const isintrachr = this.parent.state.x.chr === this.parent.state.y.chr
		const firstisx = this.isFirstX()
	}

	isFirstX() {
		if (this.parent.state.x.chr == this.parent.state.y.chr) return true
		return this.hic.chrorder.indexOf(this.parent.state.x.chr) < this.hic.chrorder.indexOf(this.parent.state.y.chr)
	}

	async render() {
		this.setResolution()
		this.setDefaultBinpx()
		this.renderAxes()
		this.renderCanvas()

		await this.update()
	}

	async update() {
		this.parent.infoBar.resolution = this.resolution
		this.parent.infoBar.update()
	}
}
