import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const IncomingCallModal = ({ caller, onAccept, onReject }: any) => {
  return (
    <Dialog open={!!caller}>
      <DialogContent>
        <DialogTitle>Incoming Call</DialogTitle>
        <DialogDescription>
          <p>
            {caller?.name} (ID: {caller?.userId}) is calling you.
          </p>
          <div className="mt-4 flex gap-4">
            <Button onClick={onAccept} className="bg-green-500 text-white">
              Accept
            </Button>
            <Button onClick={onReject} className="bg-red-500 text-white">
              Reject
            </Button>
          </div>
        </DialogDescription>
      </DialogContent>
    </Dialog>
  );
};

export default IncomingCallModal;
