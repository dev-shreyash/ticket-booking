export type NormalizedIdentifier =
  | {
      kind: "email";
      value: string;
    }
  | {
      kind: "phone";
      value: string;
    };

export type AuthUser = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  role: "CUSTOMER" | "ADMIN";
};