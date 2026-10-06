import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function AuthShell({
  title,
  description,
  children,
  aside,
}: {
  title: string;
  description: React.ReactNode;
  children: React.ReactNode;
  aside?: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-4 px-4 py-10 sm:py-16">
      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-2xl">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
      {aside}
    </div>
  );
}
