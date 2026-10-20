import australia from "@/data/customs/australia.json";
import canada from "@/data/customs/canada.json";
import france from "@/data/customs/france.json";
import germany from "@/data/customs/germany.json";
import india from "@/data/customs/india.json";
import newZealand from "@/data/customs/new-zealand.json";
import singapore from "@/data/customs/singapore.json";
import uae from "@/data/customs/uae.json";
import uk from "@/data/customs/uk.json";
import usa from "@/data/customs/usa.json";

/** Our own short summary of one FIDI customs guide (import or export). */
export type CustomsSummary = {
  updated: string;
  documents: string[];
  dutyFree: string[];
  restricted: string[];
  notes: string[];
};

export type CountryCustoms = {
  slug: string;
  name: string;
  import: CustomsSummary | null;
  export: CustomsSummary | null;
};

export type Country = CountryCustoms & {
  // Links to the full FIDI guides. FIDI allows linking but not copying, so the
  // summaries in src/data/customs are written in our own words.
  fidi: { import?: string; export?: string };
};

const dropbox = (path: string) => `https://www.dropbox.com/scl/fi/${path}&dl=0`;

export const COUNTRIES: Country[] = [
  {
    ...(australia as CountryCustoms),
    fidi: {
      import: dropbox("tsseicm2tnxo52wo8ybul/AUSTRALIA-Import-FIDI-Customs-Guide.pdf?rlkey=iuf3hncwf847tmk6fvl8ap8ir"),
      export: dropbox("6akqsqlrjb0g9s28zg2ht/AUSTRALIA-Export-FIDI-Customs-Guide.pdf?rlkey=88wquxaq9mewjwu9et3m3mgt9"),
    },
  },
  {
    ...(canada as CountryCustoms),
    fidi: {
      import: dropbox("ojc5azl0a8pxrgmvyxsdq/CANADA-Import-FIDI-Customs-Guide.pdf?rlkey=i4260cqdrkvty1o9qp0k5dn3p"),
      export: dropbox("p9gkctklnwcr7py82776t/CANADA-Export-FIDI-Customs-Guide.pdf?rlkey=brmxos1ltlh35ne9p3lzew15d"),
    },
  },
  {
    ...(france as CountryCustoms),
    fidi: {
      import: dropbox("izpehf6jbbip7cifxi56y/FRANCE-Import-FIDI-Customs-Guide.pdf?rlkey=yfbi8rawn7rurxiqkocjgx4gq"),
      export: dropbox("3miup548b7xoybvqyhcl7/FRANCE-Export-FIDI-Customs-Guide.pdf?rlkey=tz0kiozxwax0huaszafzeklg1"),
    },
  },
  {
    ...(germany as CountryCustoms),
    fidi: {
      import: dropbox("pjfaiv57b87g42aib50pr/GERMANY-Import-FIDI-Customs-Guide.pdf?rlkey=7kuqswe68ue1av7ykpxkimjn9"),
      export: dropbox("chd8gzzjqv9aq2hn6clgz/GERMANY-Export-FIDI-Customs-Guide.pdf?rlkey=m8gggcne4wnh9hodxwuolpyvy"),
    },
  },
  {
    ...(india as CountryCustoms),
    fidi: {
      import: dropbox("ft5hukwssgmclz9fkejhk/INDIA-Import-FIDI-Customs-Guide.pdf?rlkey=ziu228nhv0w2c2f0xnepf9tes"),
      export: dropbox("tlwdvdjdeacpocr3aw0ma/INDIA-Export-FIDI-Customs-Guide.pdf?rlkey=m3ijqko41x6sm1xclnzqzjwg7"),
    },
  },
  {
    ...(newZealand as CountryCustoms),
    fidi: {
      import: dropbox("6p56b6wli4gbfz6xr5ae7/NEW-ZEALAND-Import-FIDI-Customs-Guide.pdf?rlkey=war0wyquf3pdmfnyh2svjyp9k"),
      export: dropbox("7s65jpifg9frp53vm59bu/NEW-ZEALAND-Export-FIDI-Customs-Guide.pdf?rlkey=o8bht4idd90qg3avooophiso4"),
    },
  },
  {
    ...(singapore as CountryCustoms),
    fidi: {
      import: dropbox("atfvl917w9ews03lpgunl/SINGAPORE-Import-FIDI-Customs-Guide.pdf?rlkey=mngnbwki6zjan6ejxpbm88tvj"),
      export: dropbox("kfehldcgwj1y8ehcdyv7q/SINGAPORE-Export-FIDI-Customs-Guide.pdf?rlkey=kvctgcrhi8umzj59r7heaw25h"),
    },
  },
  {
    ...(uae as CountryCustoms),
    fidi: {
      import: dropbox("tpxv342eynfq2fjrbyqa6/UAE-Import-FIDI-Customs-Guide.pdf?rlkey=437cvxfmsr6ja320vut64ytpe"),
      export: dropbox("4dyke17wfhhuuczaowr85/UAE-Export-FIDI-Customs-Guide.pdf?rlkey=wwezq8q8icruesivkgl40ygpw"),
    },
  },
  {
    ...(uk as CountryCustoms),
    fidi: {
      import: dropbox("iuxec8uqa3lcq1aurtddu/UNITED-KINGDOM-Import-FIDI-Customs-Guide.pdf?rlkey=1ihqw0fh0lnzhw8bo2y9r9ncz"),
    },
  },
  {
    ...(usa as CountryCustoms),
    fidi: {
      import: dropbox("6vuktyl8744cohbszt6cx/USA-Import-FIDI-Customs-Guide.pdf?rlkey=1e5gn2cs104aixc7mtmxfai55"),
      export: dropbox("d7f1kp2z2czrtbt4618yl/USA-Export-FIDI-Customs-Guide.pdf?rlkey=dx47t3p90ylqu1f6hn1jgta4q"),
    },
  },
];

export const countryBySlug = (slug: string) => COUNTRIES.find((c) => c.slug === slug);

/** Our country, or a stand-in for a destination we have no customs summary for yet ("Japan"). */
export const countryOrOther = (slug: string): Country | undefined =>
  countryBySlug(slug) ?? (slug ? { slug, name: slug, import: null, export: null, fidi: {} } : undefined);

/** Needed for almost every international household move, whatever the route. */
export const GENERAL_DOCUMENTS = [
  "Passport (copy of the photo page)",
  "Visa, work permit or residence permit for your new country",
  "Detailed inventory of everything you are shipping, in English",
  "Bill of lading or air waybill (your mover arranges this)",
  "Signed authorisation letter so your mover can clear customs for you",
];
