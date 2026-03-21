import { redirect } from "next/navigation";

type EditTaskPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditTaskPage({ params }: EditTaskPageProps) {
  await params;
  redirect("/tasks");
}
