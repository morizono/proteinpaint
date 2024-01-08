import { ErrorResponse } from './errorResponse'
import { Filter } from '../filter'

export type Gene = {
	/** gene symbol, required */
	gene: string
	/** optionally, client may supply chr/start/stop; if missing, backend code may add them when processing native dataset */
	chr?: string
	start?: number
	stop?: number
}

export type TermdbClusterRequest = {
	/** Genome id */
	genome: string
	/** Dataset label */
	dslabel: string
	/** cluster method */
	clusterMethod: 'average' | 'complete'
	/** TODO new param distance metric */
	/** Data type */
	dataType: 3 // create union to support more types
	/** List of genes TODO can be non-genes when dataType is generalized */
	genes: Gene[]
	/** pp filter */
	filter?: Filter
	/** todo gdc filter */
	filter0?: any
}

export type Children = {
	/**  */
	id: number
	/**  */
	children: number[]
}

export type Dendro = {
	id1: number
	id2: number
	x1: number
	x2: number
	y1: number
	y2: number
}

export type Clustering = {
	/**  */
	col_children: Children[]
	/**  */
	row_children: Children[]
	/**  */
	col_dendro: Dendro[]
	/**  */
	row_dendro: Dendro[]
	/**  */
	geneNameLst: string[]
	/**  */
	sampleNameLst: string[]
	/**  */
	matrix: number[][]
	/** to be deleted */
	col_names_index: number[]
}

// response with clustering result of multiple gene/rows
export type ValidResponse = {
	/**  */
	clustering: Clustering
	/**  */
	byTermId: { [index: string]: any }
	/**  */
	bySampleId: { [index: string]: any }
}

//response of just 1 gene, thus unable to do clustering
export type SinglegeneResponse = {
	gene: string
	data: any
}

export type TermdbClusterResponse = ErrorResponse | ValidResponse | SinglegeneResponse
