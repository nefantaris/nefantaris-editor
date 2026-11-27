export type AddOnAvailability = "ready" | "checkOnline" | "comingSoon";

export type CatalogAddOn = {
  name: string;
  title: string;
  description: string;
  adds: string;
  repositoryUrl: string;
  availability: AddOnAvailability;
};

export const addOnCatalog: CatalogAddOn[] = [
  {
    name: "nefantaris-plugin-date-fns",
    title: "Dates",
    description:
      "Shows dates in a friendly, readable way, like the day a post went up.",
    adds: "Date formatting your theme can use.",
    repositoryUrl: "https://github.com/nefantaris/nefantaris-plugin-date-fns",
    availability: "ready",
  },
  {
    name: "nefantaris-plugin-icons",
    title: "Icons",
    description:
      "A large set of small pictures, like arrows, symbols, and social media logos.",
    adds: "An icon set your theme can use.",
    repositoryUrl: "https://github.com/nefantaris/nefantaris-plugin-icons",
    availability: "checkOnline",
  },
  {
    name: "nefantaris-plugin-forms",
    title: "Contact form",
    description:
      "Lets visitors send you a message from your site. Messages arrive in Slack, Discord, or your email.",
    adds: "A contact form block for your pages.",
    repositoryUrl: "https://github.com/nefantaris/nefantaris-plugin-forms",
    availability: "comingSoon",
  },
];

export function addOnTitleFor(name: string): string {
  return addOnCatalog.find((addOn) => addOn.name === name)?.title ?? name;
}
