import { redirect } from "next/navigation";

// The dashboard does not exist yet, so the home address goes to the login page.
export default function Home() {
  redirect("/login");
}
