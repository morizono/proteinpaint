import { select } from 'd3-selection'

export function setRenderers(self) {
	self.render = function() {
		const s = self.settings.matrix
		const l = self.layout
		const d = self.dimensions
		const duration = self.dom.svg.attr('width') ? s.duration : 0
		const x = s.zoomLevel <= 1 && d.mainw >= d.zoomedMainW ? 0 : Math.abs(d.seriesXoffset) / d.zoomedMainW
		self.dom.clipRect
			.attr('x', x)
			.attr('y', 0)
			.attr('width', Math.min(d.mainw, d.maxMainW) / d.zoomedMainW)
			.attr('height', 1)

		self.renderSerieses(s, l, d, duration)
		self.renderLabels(s, l, d, duration)
	}

	self.renderSerieses = function(s, l, d, duration) {
		self.dom.seriesesG
			.transition()
			.duration(duration)
			.attr('transform', `translate(${d.xOffset + d.seriesXoffset},${d.yOffset})`)

		const sg = self.dom.seriesesG.selectAll('.sjpp-mass-series-g').data(this.serieses, series => series.tw.$id)

		sg.exit().remove()
		sg.each(self.renderSeries)
		sg.enter()
			.append('g')
			.attr('class', 'sjpp-mass-series-g')
			.style('opacity', 0.001)
			.each(self.renderSeries)
	}

	self.renderSeries = async function(series) {
		const s = self.settings.matrix
		const d = self.dimensions
		const g = select(this)
		const duration = g.attr('transform') ? s.duration : 0

		g.transition()
			.duration(duration)
			.attr('transform', `translate(${series.x},${series.y})`)
			.style('opacity', 1)
		const last = series.cells[series.cells.length - 1]
		const height = series.y + last?.y + s.rowh

		if (s.useCanvas) {
			const df = self.stateDiff
			if (g.selectAll('image').size() && !df.nonsettings && !df.sorting && !df.cellDimensions) return
			const pxr = 1 //window.devicePixelRatio; console.log(51, 'pixelRatio', pxr)
			g.selectAll('*').remove()
			const width = Math.floor(d.zoomedMainW * pxr)
			const height = Math.floor(self.dimensions.mainh * pxr)
			const canvas = window.OffscreenCanvas
				? new OffscreenCanvas(width, height)
				: // TODO: no need to support older browser versions???
				  self.dom.holder
						.append('canvas')
						.attr('width', width + 'px')
						.attr('height', height + 'px')
						.style('opacity', 0)
						.node()
			const ctx = canvas.getContext('2d')
			ctx.scale(pxr, pxr)
			for (const cell of series.cells) self.renderCellWithCanvas(ctx, cell, series, s, d)

			if (window.OffscreenCanvas) {
				//const bitmap = canvas.transferToImageBitmap()
				//g.append('image').node().getContext('bitmaprenderer').transferFromImageBitmap(bitmap)
				const blob = await canvas.convertToBlob()
				const reader = new FileReader()
				reader.addEventListener('load', () => g.append('image').attr('xlink:href', reader.result), false)
				const dataURL = reader.readAsDataURL(blob)
			} else {
				const dataURL = canvas.toDataURL()
				g.append('image').attr('xlink:href', dataURL)
				if (!window.OffscreenCanvas) canvas.remove()
			}
		} else {
			const rects = g.selectAll('rect').data(series.cells, (cell, i) => cell.sample + ';;' + cell.tw.$id + ';;' + i)
			rects.exit().remove()
			rects.each(self.renderCell)
			rects
				.enter()
				.append('rect')
				.each(self.renderCell)
		}
	}

	self.renderCellWithCanvas = function(ctx, cell, series, s, d, pxr) {
		if (!cell.fill)
			cell.fill = cell.$id in self.colorScaleByTermId ? self.colorScaleByTermId[cell.$id](cell.key) : getRectFill(cell)
		const x = cell.x || 0
		const y = cell.y || 0
		const width = cell.width || d.colw
		const height = cell.height || s.rowh
		ctx.fillStyle = cell.fill
		ctx.fillRect(x, y, width, height)
	}

	self.renderCell = function(cell) {
		if (!cell.fill)
			cell.fill = cell.$id in self.colorScaleByTermId ? self.colorScaleByTermId[cell.$id](cell.key) : getRectFill(cell)
		const s = self.settings.matrix
		const rect = select(this)
			.transition()
			// TODO: use s.duration if there is a way to avoid any remaining glitchy transitions
			// using the cell index in the .data() bind function seems to fix glitches in split cells,
			// but cells with overriden values flashes during a transition
			.duration(0) //'x' in cell ? s.duration : 0)
			.attr('x', cell.x || 0)
			.attr('y', cell.y || 0)
			.attr('width', cell.width || self.dimensions.colw)
			.attr('height', cell.height || s.rowh)
			.attr('shape-rendering', 'crispEdges')
			//.attr('stroke', cell.fill)
			.attr('stroke-width', 0)
			.attr('fill', cell.fill)
	}

	self.renderLabels = function(s, l, d, duration) {
		for (const direction of ['top', 'btm', 'left', 'right']) {
			const side = l[direction]
			side.box
				.style('display', side.display || '')
				.transition()
				.duration(duration)
				.attr('transform', side.attr.boxTransform)

			const labels = side.box.selectAll('.sjpp-matrix-label').data(side.data, side.key)
			labels.exit().remove()
			labels.each(renderLabel)
			labels
				.enter()
				.append('g')
				.attr('class', 'sjpp-matrix-label')
				.each(renderLabel)

			function renderLabel(lab) {
				const g = select(this)
				const textduration = g.attr('transform') ? duration : 0
				g.transition()
					.duration(textduration)
					.attr('transform', side.attr.labelGTransform)

				if (!g.select(':scope>text').size()) g.append('text')
				const showContAxis = !side.isGroup && lab.tw?.q?.mode == 'continuous'
				const labelText = side.label(lab)
				const text = g.select(':scope>text').attr('fill', '#000')

				text
					.transition()
					.duration(textduration)
					.attr('opacity', side.attr.fontSize < 6 || labelText === 'configure' ? 0 : 1)
					.attr('font-size', side.attr.fontSize)
					.attr('text-anchor', side.attr.labelAnchor)
					.attr('transform', side.attr.labelTransform)
					.attr('cursor', 'pointer')
					.attr(side.attr.textpos.coord, side.attr.textpos.factor * (showContAxis ? 30 : 0))
					.text(side.label)

				text
					.on('mouseover', labelText === 'configure' ? () => text.attr('opacity', 0.5) : null)
					.on('mouseout', labelText === 'configure' ? () => text.attr('opacity', 0) : null)

				if (showContAxis && labelText) {
					if (!g.select('.sjpp-matrix-cell-axis').size()) {
						g.append('g')
							.attr('class', 'sjpp-matrix-cell-axis')
							.attr('shape-rendering', 'crispEdges')
					}
					const axisg = g.select('.sjpp-matrix-cell-axis')
					axisg.selectAll('*').remove()
					const domain = [lab.counts.maxval, lab.counts.minval]
					if (s.transpose) domain.reverse()
					const d = self.dimensions
					const x = !s.transpose ? 0 : lab.tw.settings.gap - 1 - lab.labelOffset
					const y = !s.transpose ? lab.tw.settings.gap - 1 - lab.labelOffset : 0
					axisg
						.attr('shape-rendering', 'crispEdges')
						.attr('transform', `translate(${x},${y})`)
						.call(side.attr.axisFxn(lab.scale.domain(domain)).tickValues(domain))
				}
			}
		}
	}

	self.colLabelGTransform = (lab, grpIndex) => {
		const s = self.settings.matrix
		const d = self.dimensions
		lab.labelOffset = 0.8 * d.colw
		const x = lab.grpIndex * s.colgspace + lab.totalIndex * d.dx + lab.labelOffset + lab.totalHtAdjustments
		const y = 0 //lab.tw?.q?.mode == 'continuous' ? -30 : 0
		return `translate(${x + d.seriesXoffset},${y})`
	}

	self.colGrpLabelGTransform = (lab, grpIndex) => {
		const s = self.settings.matrix
		const d = self.dimensions
		const len = (lab.processedLst || lab.grp.lst).length
		const x =
			lab.grpIndex * s.colgspace +
			lab.prevGrpTotalIndex * d.dx +
			(len * d.dx) / 2 +
			s.grpLabelFontSize / 2 +
			lab.totalHtAdjustments
		return `translate(${x + d.seriesXoffset},0)`
	}

	self.rowLabelGTransform = (lab, grpIndex) => {
		const s = self.settings.matrix
		const d = self.dimensions
		const x = 0 // lab.tw?.q?.mode == 'continuous' ? -30 : 0
		lab.labelOffset = 0.7 * s.rowh
		const y = lab.grpIndex * s.rowgspace + lab.totalIndex * d.dy + lab.labelOffset + lab.totalHtAdjustments
		return `translate(${x},${y})`
	}

	self.rowGrpLabelGTransform = (lab, grpIndex) => {
		const s = self.settings.matrix
		const d = self.dimensions
		const len = (lab.processedLst || lab.grp.lst).length
		const y =
			lab.grpIndex * s.rowgspace +
			lab.prevGrpTotalIndex * d.dy +
			(len * d.dy) / 2 +
			s.grpLabelFontSize / 2 +
			lab.totalHtAdjustments
		return `translate(0,${y})`
	}

	self.rowAxisGTransform = (lab, grpIndex) => {
		const s = self.settings.matrix
		const d = self.dimensions
		const x = 0 // lab.tw?.q?.mode == 'continuous' ? -30 : 0
		const y = lab.grpIndex * s.rowgspace + lab.totalIndex * d.dy + 0.7 * s.rowh + lab.totalHtAdjustments
		return `translate(${x},${y})`
	}

	self.adjustSvgDimensions = async function(prevTranspose) {
		const s = self.settings.matrix
		const d = self.dimensions
		const duration = self.dom.svg.attr('width') ? s.duration : 10

		// wait for labels to render; when transposing, must wait for
		// the label rotation to end before measuring the label height and width
		await sleep(prevTranspose == s.transpose ? duration : s.duration)

		const topBox = self.layout.top.box.node().getBBox()
		const btmBox = self.layout.btm.box.node().getBBox()
		const leftBox = self.layout.left.box.node().getBBox()
		const rtBox = self.layout.right.box.node().getBBox()
		const legendBox = self.dom.legendG.node().getBBox()
		const seriesBox = self.dom.seriesesG.node().getBBox()

		d.extraWidth = leftBox.width + rtBox.width + s.margin.left + s.margin.right + s.rowlabelgap * 2
		d.extraHeight = topBox.height + btmBox.height + s.margin.top + s.margin.bottom + s.collabelgap * 2
		d.svgw = d.mainw + d.extraWidth
		d.svgh = d.mainh + d.extraHeight + legendBox.height + 20 + s.scrollHeight
		self.dom.svg
			.transition()
			.duration(duration)
			.attr('width', d.svgw)
			.attr('height', d.svgh)

		const x = leftBox.width - self.layout.left.offset
		const y = topBox.height - self.layout.top.offset
		self.dom.mainG
			.transition()
			.duration(duration)
			.attr('transform', `translate(${x},${y})`)

		// this position is based on layout.btm.attr.boxTransform, plus box height and margins
		const legendX = d.xOffset + (s.transpose ? 20 : 0)
		const legendY = d.yOffset + d.mainh + s.collabelgap + btmBox.height + 20

		self.dom.legendG
			.transition()
			.duration(duration)
			.attr('transform', `translate(${legendX},${legendY})`)
	}
}

function getRectFill(d) {
	if (d.fill) return d.fill
	/*** TODO: class should be for every values entry, as applicable ***/
	const cls = d.class || (Array.isArray(d.values) && d.values[0].class)
	return cls ? mclass[cls].color : '#555'
}

function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms))
}
