"use client";

import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function SettingsPage() {
  const { data } = useAuth();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Account and preferences. Password change + email change land in a follow-up phase.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profile</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <div>
            <p className="text-xs text-muted-foreground">Email</p>
            <p>{data?.user.email ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Name</p>
            <p>{data?.user.name ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Tier</p>
            <p className="capitalize">{data?.user.tier ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Member since</p>
            <p>
              {data?.user.createdAt
                ? new Date(data.user.createdAt).toLocaleDateString()
                : "—"}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
