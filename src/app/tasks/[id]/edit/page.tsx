import { redirect } from "next/navigation";

type EditTaskPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditTaskPage({ params }: EditTaskPageProps) {
  const { id } = await params;
  redirect(`/tasks?modal=edit&taskId=${id}`);
}
