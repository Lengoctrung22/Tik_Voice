import ProjectEditorClient from './ProjectEditorClient';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ProjectEditorPage({ params }: Props) {
  const { id } = await params;
  return <ProjectEditorClient id={id} />;
}
