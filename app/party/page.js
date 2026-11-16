import Party from "./Party";

export const metadata = { title: "Dogfight · Skyllion" };

export default async function Page({ searchParams }) {
  const { room } = await searchParams;
  return <Party code={typeof room === "string" ? room.toUpperCase().slice(0, 5) : null} />;
}
