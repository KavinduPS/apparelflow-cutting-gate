import { LogoutButton } from "@/components/logout-button";

type RolePageHeaderProps = {
  title: string;
  fullName: string;
};

const RolePageHeader = ({ title, fullName }: RolePageHeaderProps) => {
  return (
    <header className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <div>
        <h1 className="text-xl font-bold text-gray-900">{title}</h1>

        <p className="mt-1 text-sm text-gray-600">
          Logged in as{" "}
          <span className="font-semibold text-gray-900">{fullName}</span>
        </p>
      </div>

      <LogoutButton />
    </header>
  );
};

export default RolePageHeader;
