export type City = {
  slug: string;
  name: string;
  country: string;
  avgPrice: number;
  avgRating: number;
  avgPhotos: number;
};

export const cities: City[] = [
  {
    slug: "paris",
    name: "Paris",
    country: "France",
    avgPrice: 165,
    avgRating: 4.7,
    avgPhotos: 23,
  },
  {
    slug: "london",
    name: "London",
    country: "United Kingdom",
    avgPrice: 190,
    avgRating: 4.6,
    avgPhotos: 21,
  },
  {
    slug: "barcelona",
    name: "Barcelona",
    country: "Spain",
    avgPrice: 150,
    avgRating: 4.8,
    avgPhotos: 25,
  },
  {
    slug: "lisbon",
    name: "Lisbon",
    country: "Portugal",
    avgPrice: 135,
    avgRating: 4.8,
    avgPhotos: 22,
  },
  {
    slug: "rome",
    name: "Rome",
    country: "Italy",
    avgPrice: 155,
    avgRating: 4.7,
    avgPhotos: 20,
  },
];

export function getCityBySlug(slug: string): City | undefined {
  return cities.find((city) => city.slug === slug);
}
