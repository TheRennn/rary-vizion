import { notFound } from 'next/navigation';
import DemoStudio from './studio';

export default function DemoPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <DemoStudio />;
}
