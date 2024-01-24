import * as client from '#src/client'
import * as common from '#shared/common'
import { defaultnmeth } from './hic.straw'

type Mutation = {
	chr1: string
	chr2: string
	position1: string | number
	position2: string | number
	reads1: string | number
	reads2: string | number
}

//Will rename once hic.straw refactored to class
export async function hicParseFile(hic: any, debugmode: boolean, self: any) {
	if (debugmode) window['hic'] = hic
	if (!hic.name) hic.name = 'Hi-C'
	if (hic.tklst) {
		const lst = [] as any[]
		for (const t of hic.tklst) {
			if (!t.type) {
				self.error('type missing from one of the tracks accompanying HiC')
			} else {
				t.iscustom = true
				lst.push(t)
			}
		}
		if (lst.length) {
			hic.tklst = lst
		} else {
			delete hic.tklst
		}
	}
	if (hic.enzyme) {
		if (hic.genome.hicenzymefragment) {
			let frag: any = null
			for (const f of hic.genome.hicenzymefragment) {
				if (f.enzyme == hic.enzyme) {
					frag = f
					break
				}
			}
			if (frag) {
				hic.enzymefile = frag.file
			} else {
				self.error('unknown enzyme: ' + hic.enzyme)
				delete hic.enzyme
			}
		} else {
			self.error('no enzyme fragment information available for this genome')
			delete hic.enzyme
		}
	}

	// data tasks:
	// 1. load sv
	// 2. stat the hic file
	try {
		if (hic.sv && hic.sv.file) {
			const re = await client.dofetch(hic.hostURL + '/textfile', {
				method: 'POST',
				body: JSON.stringify({ file: hic.sv.file, jwt: hic.jwt })
			})
			const data = re.json()
			const [err, header, items] = parseSV(data.text)
			if (err) throw { message: 'Error parsing SV: ' + err }
			hic.sv.header = header
			hic.sv.items = items
		}
		const data = await client.dofetch2('hicstat?' + (hic.file ? 'file=' + hic.file : 'url=' + hic.url))
		if (data.error) throw { message: data.error.error }
		const err = hicparsestat(hic, data.out)
		if (err) throw { message: err }
	} catch (err: any) {
		self.errList.push(err.message || err)
		if (err.stack) {
			console.log(err.stack)
		}
	}

	/** Default args for each view */
	const initialNmeth = hic.normalization.length ? hic.normalization[0] : defaultnmeth

	self.genomeview.nmeth = initialNmeth
	self.chrpairview.nmeth = initialNmeth
	self.detailview.nmeth = initialNmeth

	if (self.errList.length) self.error(self.errList)
	return hic
}

function parseSV(txt: string) {
	const lines = txt.trim().split(/\r?\n/)
	const [err, header] = parseSVheader(lines[0])
	if (err) return ['header error: ' + err]

	const items = [] as any
	for (let i = 1; i < lines.length; i++) {
		const line = lines[i]
		if (line[0] == '#') continue
		const [e, m] = parseSVline(line, header)
		if (e) return ['line ' + (i + 1) + ' error: ' + e]
		items.push(m)
	}
	return [null, header, items]
}

function parseSVheader(line: string) {
	const header = line.toLowerCase().split('\t')
	if (header.length <= 1) return 'invalid file header for fusions'
	const htry = (...lst) => {
		for (const a of lst) {
			const j = header.indexOf(a)
			if (j != -1) return j
		}
		return -1
	}
	let i = htry('chr_a', 'chr1', 'chra')
	if (i == -1) return 'chr_A missing from header'
	header[i] = 'chr1'
	i = htry('chr_b', 'chr2', 'chrb')
	if (i == -1) return 'chr_B missing from header'
	header[i] = 'chr2'
	i = htry('pos_a', 'position_a', 'position1', 'posa')
	if (i == -1) return 'pos_a missing from header'
	header[i] = 'position1'
	i = htry('pos_b', 'position_b', 'position2', 'posb')
	if (i == -1) return 'pos_b missing from header'
	header[i] = 'position2'
	i = htry('strand_a', 'orta', 'orienta')
	if (i == -1) return 'strand_a missing from header'
	header[i] = 'strand1'
	i = htry('strand_b', 'ortb', 'orientb')
	if (i == -1) return 'strand_b missing from header'
	header[i] = 'strand2'
	// optional
	i = htry('numreadsa')
	if (i != -1) header[i] = 'reads1'
	i = htry('numreadsb')
	if (i != -1) header[i] = 'reads2'

	return [null, header]
}

function parseSVline(line: string, header: any) {
	const lst = line.split('\t')
	const m: Partial<Mutation> = {}

	for (let j = 0; j < header.length; j++) {
		m[header[j]] = lst[j]
	}
	if (!m.chr1) return ['missing chr1']
	if (m.chr1.toLowerCase().indexOf('chr') != 0) {
		m.chr1 = 'chr' + m.chr1
	}
	if (!m.chr2) return ['missing chr2']
	if (m.chr2.toLowerCase().indexOf('chr') != 0) {
		m.chr2 = 'chr' + m.chr2
	}
	if (!m.position1) return ['missing position1']
	let v = Number.parseInt(m.position1 as string)
	if (Number.isNaN(v) || v <= 0) return ['position1 invalid value']
	m.position1 = v
	if (!m.position2) return ['missing position2']
	v = Number.parseInt(m.position2 as string)
	if (Number.isNaN(v) || v <= 0) return ['position2 invalid value']
	m.position2 = v
	if (m.reads1) {
		v = Number.parseInt(m.reads1 as string)
		if (Number.isNaN(v)) return ['reads1 invalid value']
		m.reads1 = v
	}
	if (m.reads2) {
		v = Number.parseInt(m.reads2 as string)
		if (Number.isNaN(v)) return ['reads2 invalid value']
		m.reads2 = v
	}
	return [null, m]
}

export function hicparsestat(hic: any, j: any) {
	if (!j) return 'cannot stat hic file'
	hic.normalization = j.normalization

	hic.version = j.version

	if (!j.Chromosomes) return 'Chromosomes not found in file stat'
	if (!Array.isArray(j.chrorder)) return '.chrorder[] missing'
	if (j.chrorder.length == 0) return '.chrorder[] empty array'
	hic.chrorder = j.chrorder
	if (!j['Base pair-delimited resolutions']) return 'Base pair-delimited resolutions not found in file stat'
	if (!Array.isArray(j['Base pair-delimited resolutions'])) return 'Base pair-delimited resolutions should be array'
	hic.bpresolution = j['Base pair-delimited resolutions']
	if (!j['Fragment-delimited resolutions']) return 'Fragment-delimited resolutions not found in file stat'
	if (!Array.isArray(j['Fragment-delimited resolutions'])) return 'Fragment-delimited resolutions is not array'
	hic.fragresolution = j['Fragment-delimited resolutions']

	const chrlst = [] as any[]
	for (const chr in j.Chromosomes) {
		chrlst.push(chr)
	}
	const [nochrcount, haschrcount] = common.contigNameNoChr2(hic.genome, chrlst)
	if (nochrcount + haschrcount == 0) return 'chromosome names do not match with genome build'
	if (nochrcount > 0) {
		hic.nochr = true
		// prepend 'chr' to names in chrorder array
		for (let i = 0; i < hic.chrorder.length; i++) hic.chrorder[i] = 'chr' + hic.chrorder[i]
	}
	// as a way of skipping chrM
	hic.chrlst = []
	for (const chr of hic.genome.majorchrorder) {
		const c2 = hic.nochr ? chr.replace('chr', '') : chr
		if (chrlst.indexOf(c2) != -1) {
			hic.chrlst.push(chr)
		}
	}
}
