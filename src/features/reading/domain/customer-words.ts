import { searchText } from "@/shared/domain/search-text";

// Words people write before a name that are not the name: a way of addressing someone, or the kind of place
const titles = [
  "phòng khám",
  "bệnh viện",
  "nha khoa",
  "nhà thuốc",
  "đại lý",
  "công ty",
  "chị",
  "anh",
  "em",
  "cô",
  "chú",
  "bác",
  "ông",
  "bà",
  "nk",
  "pk",
  "bv",
  "nt",
  "đl",
  "cty",
] as const;

// The words of a name as written, without the titles and kinds in front of it: "chị Lan" is "lan", "nk Ánh Dương" is
// "anh duong". Titles are matched with their accents, so "Ánh Dương" keeps its "Ánh"; a message typed without
// accents is matched without them, where "anh duong" may lose its first word - and then matches more customers,
// which asks rather than guesses.
export function nameWords(written: string): ReadonlyArray<string> {
  const lower = written.normalize("NFC").toLocaleLowerCase("vi").replace(/\s+/g, " ").trim();
  const forms = searchText(lower) === lower ? titles.map(searchText) : titles;

  let rest = lower;
  for (let dropped = true; dropped;) {
    dropped = false;
    for (const title of forms) {
      if (rest === title) {
        rest = "";
      } else if (rest.startsWith(`${title} `)) {
        rest = rest.slice(title.length + 1);
        dropped = true;
      }
    }
  }
  const name = searchText(rest);

  return name === "" ? [] : name.split(" ");
}
