import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';

export function ChartCard(props: {
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={props.className}>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle>{props.title}</CardTitle>
          {props.right ? <div>{props.right}</div> : null}
        </div>
      </CardHeader>
      <CardContent>{props.children}</CardContent>
    </Card>
  );
}


