import type { DatasetSource, ElectionDataset } from '@recount/engine';
import type { Parsed } from './ballots';
import { parseClearBallotCvr } from './clearBallot';
import { parseFairVoteCvr } from './fairvote';
import { parseMinneapolisCvr } from './minneapolis';
import { parseNycCvr } from './nycEss';

export interface DatasetSpec extends Omit<ElectionDataset, 'candidates' | 'ballots' | 'source'> {
  source: Omit<DatasetSource, 'sha256'>;
  parse(raw: Buffer): Promise<Parsed> | Parsed;
}

const NYC = { publisher: 'Board of Elections in the City of New York', license: 'Public record' };
const MPLS = { publisher: 'City of Minneapolis Elections & Voter Services', license: 'Public record' };
const MPLS_CVR = 'https://vote.minneapolismn.gov/media/-www-content-assets/documents/archive/elections';
const FAIRVOTE = {
  publisher: 'FairVote (D. Otis), Harvard Dataverse doi:10.7910/DVN/AMK8PJ',
  license: 'CC0 1.0',
};
const text = (raw: Buffer) => raw.toString('utf8');

export const DATASETS: DatasetSpec[] = [
  {
    slug: 'nyc-2025-dem-mayor',
    title: 'New York City 2025 Democratic primary for Mayor',
    jurisdiction: 'New York City, NY',
    date: '2025-06-24',
    office: 'Mayor (Democratic primary)',
    seats: 1,
    presetId: 'nyc',
    source: {
      ...NYC,
      url: 'https://www.vote.nyc/sites/default/files/pdf/election_results/2025/20250624Primary%20Election/rcv/2025_Primary_CVR_2025-07-17.zip',
      file: 'nyc/2025_Primary_CVR_2025-07-17.zip',
      retrievedAt: '2026-10-19',
      contest: 'DEM Mayor Citywide',
    },
    reportConvention: {
      inactive: 'afterFirstRound',
      notes: 'The Board reports inactive ballots from round 2 on; ballots blank or overvoted at the first marked rank are not counted as inactive.',
    },
    parse: (raw) => parseNycCvr(raw, 'DEM Mayor Choice'),
  },
  {
    slug: 'nyc-2026-council-d3',
    title: 'New York City 2026 Democratic primary for City Council, District 3',
    jurisdiction: 'New York City, NY',
    date: '2026-06-23',
    office: 'City Council Member, 3rd District (Democratic primary)',
    seats: 1,
    presetId: 'nyc',
    source: {
      ...NYC,
      url: 'https://www.vote.nyc/sites/default/files/pdf/election_results/2026/20260623Primary%20Election/2026_Primary_CVR_2026-06-23.zip',
      file: 'nyc/2026_Primary_CVR_2026-06-23.zip',
      retrievedAt: '2026-10-19',
      contest: 'DEM Council Member 3rd Council District',
    },
    reportConvention: {
      inactive: 'afterFirstRound',
      notes: 'The Board reports inactive ballots from round 2 on; ballots blank or overvoted at the first marked rank are not counted as inactive.',
    },
    parse: (raw) => parseNycCvr(raw, 'DEM Council Member Choice'),
  },
  {
    slug: 'minneapolis-2025-mayor',
    title: 'Minneapolis 2025 Mayor',
    jurisdiction: 'Minneapolis, MN',
    date: '2025-11-04',
    office: 'Mayor',
    seats: 1,
    presetId: 'minneapolis-irv',
    source: {
      ...MPLS,
      url: `${MPLS_CVR}/2025-Mayor-Cast-Vote-Record.csv`,
      file: 'minneapolis/2025-Mayor-Cast-Vote-Record.csv',
      retrievedAt: '2026-10-19',
      contest: 'Mayor',
    },
    reportConvention: {
      inactive: 'afterFirstRound',
      notes: 'Ballots with only skipped or overvoted rankings are reported as undervotes, so "Exhausted" starts at 0 in round 1.',
    },
    parse: (raw) => parseMinneapolisCvr(text(raw)),
  },
  {
    slug: 'minneapolis-2025-park-at-large',
    title: 'Minneapolis 2025 Park and Recreation Commissioner At Large',
    jurisdiction: 'Minneapolis, MN',
    date: '2025-11-04',
    office: 'Park and Recreation Commissioner At Large (3 seats)',
    seats: 3,
    presetId: 'minneapolis-stv',
    source: {
      ...MPLS,
      url: `${MPLS_CVR}/2025-Park-At-Large-CVR.csv`,
      file: 'minneapolis/2025-Park-At-Large-CVR.csv',
      retrievedAt: '2026-10-19',
      contest: 'Park and Recreation Commissioner At Large',
    },
    reportConvention: {
      inactive: 'afterFirstRound',
      notes: 'Ballots with only skipped or overvoted rankings are reported as undervotes, so "Exhausted" starts at 0 in round 1.',
    },
    parse: (raw) => parseMinneapolisCvr(text(raw)),
  },
  {
    slug: 'minneapolis-2025-bet',
    title: 'Minneapolis 2025 Board of Estimate and Taxation',
    jurisdiction: 'Minneapolis, MN',
    date: '2025-11-04',
    office: 'Board of Estimate and Taxation (2 seats)',
    seats: 2,
    presetId: 'minneapolis-stv',
    source: {
      ...MPLS,
      url: `${MPLS_CVR}/2025-BET-Cast-Vote-Record.csv`,
      file: 'minneapolis/2025-BET-Cast-Vote-Record.csv',
      retrievedAt: '2026-10-19',
      contest: 'Board of Estimate and Taxation',
    },
    reportConvention: {
      inactive: 'afterFirstRound',
      notes: 'Ballots with only skipped or overvoted rankings are reported as undervotes.',
    },
    parse: (raw) => parseMinneapolisCvr(text(raw)),
  },
  {
    slug: 'portland-2024-d1',
    title: 'Portland, OR 2024 City Council, District 1',
    jurisdiction: 'Portland, OR',
    date: '2024-11-05',
    office: 'City Councilor, District 1 (3 seats)',
    seats: 3,
    presetId: 'portland-stv',
    source: {
      publisher: 'Multnomah County Elections Division',
      license: 'Public record',
      url: 'https://drive.usercontent.google.com/download?id=1ly3IcjeQTpet-zvxd49DM_OmY_i4uftB&export=download&confirm=t',
      file: 'portland/City_of_Portland__Councilor__District_1_2024_11_29_17_26_12.cvr.csv',
      retrievedAt: '2026-10-19',
      contest: 'City of Portland, Councilor, District 1',
    },
    reportConvention: {
      inactive: 'cumulative',
      notes: 'Official results are an RCTab summary JSON. The CVR lists every voter citywide; ballots with no mark in District 1 are left out.',
    },
    parse: (raw) => parseClearBallotCvr(text(raw), 'City of Portland, Councilor, District 1', 'Uncertified Write In'),
  },
  {
    slug: 'burlington-2009-mayor',
    title: 'Burlington, VT 2009 Mayor',
    jurisdiction: 'Burlington, VT',
    date: '2009-03-03',
    office: 'Mayor',
    seats: 1,
    presetId: 'burlington-2009',
    source: {
      ...FAIRVOTE,
      url: 'https://dataverse.harvard.edu/api/access/datafile/11593240?format=original',
      file: 'fairvote/Burlington_20090303_Mayor.csv',
      retrievedAt: '2026-10-19',
      contest: 'Mayor',
    },
    reportConvention: {
      inactive: 'cumulative',
      notes: "Ballots come from FairVote's normalised copy, not the city's own ballot file.",
    },
    parse: (raw) => parseFairVoteCvr(text(raw)),
  },
  {
    slug: 'alaska-2022-special',
    title: 'Alaska 2022 special general election, U.S. Representative',
    jurisdiction: 'Alaska',
    date: '2022-08-16',
    office: 'U.S. Representative (special general)',
    seats: 1,
    presetId: 'alaska',
    source: {
      ...FAIRVOTE,
      url: 'https://dataverse.harvard.edu/api/access/datafile/11593054?format=original',
      file: 'fairvote/Alaska_20220816_USHouse_Special.csv',
      retrievedAt: '2026-10-19',
      contest: 'U.S. Representative (Special General)',
    },
    reportConvention: {
      inactive: 'cumulative',
      notes:
        "Ballots come from FairVote's normalised copy of the Division of Elections CVR export, not the export itself. " +
        'The official report has no write-in line, so write-in marks are passed over.',
    },
    parse: (raw) => parseFairVoteCvr(text(raw), 'excluded'),
  },
];
