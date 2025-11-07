import React, { useState, useEffect } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Search,
  Camera,
  CheckCircle,
  XCircle,
  AlertCircle,
  Upload,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import axios from "axios";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface VerificationTask {
  _id: string;
  taskTitle: string;
  projectName: string;
  unit: string;
  contractorName: string;
  phase: string;
  submittedDate: string;
  priority: "high" | "medium" | "low";
  status: "pending verification" | "approved" | "rejected" | "rework";
  contractorUploadedPhotos: string[];
  submittedByContractorOn: Date;
  submittedBySiteInchargeOn: Date;
  constructionPhase: string;
  projectId: string;
  source?: "task" | "evidence"; // source is now optional
}

const priorityColors: Record<string, string> = {
  high: "bg-red-100 text-red-800",
  medium: "bg-amber-100 text-amber-800",
  low: "bg-green-100 text-green-800",
};

const statusColors: Record<string, string> = {
  "pending verification": "bg-blue-100 text-blue-800",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
  rework: "bg-amber-100 text-amber-800",
};

interface TaskVerificationListProps {
  setApprovedCount: (count: number) => void;
  setReworkCount: (count: number) => void;
  setPendingCount: (count: number) => void;
}

const TaskVerificationList: React.FC<TaskVerificationListProps> = ({
  setApprovedCount,
  setReworkCount,
  setPendingCount,
}) => {
  const [tasks, setTasks] = useState<VerificationTask[]>([]);
  const [filter, setFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [projectFilter, setProjectFilter] = useState("");
  const [verificationDialogOpen, setVerificationDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState("");
  const [verificationStatus, setVerificationStatus] = useState<
    "approved" | "rejected" | "rework"
  >("approved");
  const [notes, setNotes] = useState("");
  const [quality, setQuality] = useState<
    "excellent" | "good" | "acceptable" | "poor"
  >("good");
  const [photos, setPhotos] = useState<File[]>([]);
  const [selectedTask, setSelectedTask] = useState<VerificationTask | null>(
    null
  );

  const mapPriority = (priority?: string): VerificationTask["priority"] => {
    if (!priority) return "medium";
    const lower = priority.toLowerCase();
    if (["low", "medium", "high"].includes(lower)) return lower as any;
    return "medium";
  };

  const fetchAllData = async () => {
    setLoading(true);
    setError(""); 
    try {
      
      const [tasksRes, evidenceRes] = await Promise.all([
        axios.get(`${import.meta.env.VITE_URL}/api/project/tasks`, {
          withCredentials: true,
          timeout: 10000,
        }).catch(err => {
          console.error('Tasks API failed:', err.response?.status, err.response?.data);
          return { data: [] }; 
        }),
        axios.get(`${import.meta.env.VITE_URL}/api/evidence/evidences`, {
          withCredentials: true,
          timeout: 10000, 
        }).catch(err => {
          console.error('Evidence API failed:', err.response?.status, err.response?.data);
          return { data: [] }; 
        }),
      ]);

      const taskData = Array.isArray(tasksRes.data) ? tasksRes.data : [];
      const evidenceData = Array.isArray(evidenceRes.data) ? evidenceRes.data : [];


      // Helper function to map all contractor statuses to this page's statuses
      const mapStatus = (status: string): VerificationTask["status"] => {
        if (!status) return "pending verification";
        const s = status.toLowerCase().replace(/_/g, " "); // "pending_review" -> "pending review"

        if (
          s === "in progress" ||
          s === "completed" ||
          s === "pending review"
        ) {
          return "pending verification";
        }
        if (s === "approved" || s === "rework" || s === "rejected") {
          return s;
        }
        return "pending verification"; 
      };

      // Helper function to fix broken "https_//" URLs
      const fixUrl = (url: string) => {
        if (typeof url === "string") {
          return url.replace(/^https_(\/\/)/, "https:$1");
        }
        return url;
      };

      // 1. Transform Tasks
      const formattedTasks: VerificationTask[] = taskData.map(
        (task: any): VerificationTask => ({
          _id: task._id,
          taskTitle: task.taskTitle,
          projectName: task.projectName,
          unit: task.unit,
          contractorName: task.contractorName,
          submittedByContractorOn: task.submittedByContractorOn,
          status: mapStatus(task.status),
          priority: mapPriority(task.priority),
          contractorUploadedPhotos: (task.contractorUploadedPhotos || []).map(
            fixUrl
          ),
          constructionPhase: task.constructionPhase,
          projectId: task.projectId,
          phase: task.constructionPhase,
          submittedDate: task.submittedByContractorOn,
          submittedBySiteInchargeOn: task.submittedBySiteInchargeOn,
          source: "task",
        })
      );

      // 2. Transform Evidence
      const formattedEvidence: VerificationTask[] = evidenceData.map(
        (ev: any): VerificationTask => ({
          _id: ev._id,
          taskTitle: ev.title || "Standalone Evidence",
          projectName: ev.project?.name || ev.project || "Unknown Project",
          unit: ev.unit?.name || ev.unit || "Unknown Unit",
          contractorName: ev.contractor?.name || "N/A",
          submittedByContractorOn: ev.createdAt || ev.date || new Date(),
          status: mapStatus(ev.status),
          priority: "medium",
          
          contractorUploadedPhotos: (() => {
            if (!ev.images || !Array.isArray(ev.images)) return [];
            return ev.images.map((img: any) => {
              if (typeof img === 'string') {
                return fixUrl(img);
              } else if (img && typeof img === 'object' && img.url) {
                return fixUrl(img.url);
              }
              return null;
            }).filter((url: string | null) => url !== null && url !== '') as string[];
          })(),

          constructionPhase: ev.category || "General",
          projectId: ev.projectId || ev.project,
          phase: ev.category || "General",
          submittedDate: ev.createdAt || ev.date || new Date(),
          submittedBySiteInchargeOn: ev.submittedBySiteInchargeOn,
          source: "evidence",
        })
      );

     setTasks(combinedData);

      // 4. Calculate counts from the *newly combined* data
      const pending = combinedData.filter(
        (t) => t.status === "pending verification"
      ).length;

      const allServerItems = [...taskData, ...evidenceData]; // Use raw data for historical counts
      const approved = allServerItems.filter((t: any) => {
        return (
          mapStatus(t.status) === "approved" &&
          t.submittedBySiteInchargeOn &&
          new Date(t.submittedBySiteInchargeOn).getMonth() ===
            new Date().getMonth() &&
          new Date(t.submittedBySiteInchargeOn).getFullYear() ===
            new Date().getFullYear()
        );
      }).length;

      const rework = allServerItems.filter(
        (t: any) => mapStatus(t.status) === "rework"
      ).length;

      setPendingCount(pending);
      setApprovedCount(approved);
      setReworkCount(rework);
    } catch (err: any) {
      console.error("Error fetching tasks:", err);
      console.error("Error response:", err.response?.data);
      console.error("Error status:", err.response?.status);
      setError(`Failed to load tasks: ${err.response?.data?.message || err.message}`);
      toast.error(`Failed to load data: ${err.response?.data?.message || err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTask) {
      toast.error("No task selected!");
      return;
    }

    setIsUpdating(true);
    const loadingToast = toast.loading("Submitting verification...");

    // 1. Upload photos
    const uploadPromises = photos.map(async (photo) => {
      const formData = new FormData();
      formData.append("file", photo);
      try {
        const res = await axios.post(
          `${import.meta.env.VITE_URL}/api/uploads/upload`,
          formData,
          { headers: { "Content-Type": "multipart/form-data" } }
        );
        return res.data.url;
      } catch (err) {
        console.error("Upload failed", err);
        return null;
      }
    });

    const uploadedImageUrls = (await Promise.all(uploadPromises)).filter(
      (url) => url != null
    ) as string[];

    // 2. Create payload
    const verificationPayload = {
      noteBySiteIncharge: notes,
      qualityAssessment: quality,
      verificationDecision: verificationStatus,
      photosBySiteIncharge: uploadedImageUrls,
      status: verificationStatus,
    };

    // 3. Send data to the correct backend endpoint
    try {
      let endpointUrl = "";

      if (selectedTask.source === "evidence") {
        endpointUrl = `${
          import.meta.env.VITE_URL
        }/api/evidence/evidences/${selectedTask._id}`;
      } else {
        endpointUrl = `${import.meta.env.VITE_URL}/api/project/site-incharge/${
          selectedTask.projectId
        }/${selectedTask._id}/task`;
      }

      await axios.patch(endpointUrl, verificationPayload, {
        withCredentials: true,
      });

      toast.success("Task Updated successfully!", { id: loadingToast });
      fetchAllData();
      setVerificationDialogOpen(false);
    } catch (error) {
      toast.error("Failed to update task.", { id: loadingToast });
      console.error("Updation error:", error);
    } finally {
      // Reset form
      setNotes("");
      setPhotos([]);
      setQuality("good");
      setVerificationStatus("approved");
      setIsUpdating(false);
      setSelectedTask(null);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setPhotos((prevPhotos) => [...prevPhotos, ...newFiles]);
    }
  };

  const removePhoto = (index: number) => {
    setPhotos((prevPhotos) => prevPhotos.filter((_, i) => i !== index));
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  // Filter based on the `tasks` state and the `filter` state
  const filteredTasks = tasks.filter((task) => {
    if (!task || !task._id) return false; 
    
    // Tab filter
    if (filter !== "all" && task.status !== filter) {
      return false;
    }
    // Project filter
    if (projectFilter && task.projectName !== projectFilter) {
      return false;
    }
    // Search query filter
    if (
      searchQuery &&
      task.taskTitle &&
      !task.taskTitle.toLowerCase().includes(searchQuery.toLowerCase())
    ) {
      return false;
    }
    return true;
  });
  

  const handleQuickAction = async (
    task: VerificationTask,
    action: "approved" | "rejected" | "rework"
  ) => {
    const loadingToast = toast.loading(`Updating task to ${action}...`);

    const payload = {
      verificationDecision: action,
      noteBySiteIncharge:
        action === "approved"
          ? "Quick Approved"
          : `Quick action: ${action}. More details may be required.`,
      status: action,
    };

    try {
      let endpointUrl = "";
      if (task.source === "evidence") {
        endpointUrl = `${
          import.meta.env.VITE_URL
        }/api/evidence/evidences/${task._id}`;
      } else {
        endpointUrl = `${import.meta.env.VITE_URL}/api/project/site-incharge/${
          task.projectId
        }/${task._id}/task`;
      }

      await axios.patch(endpointUrl, payload, { withCredentials: true });

      if (action === "approved") {
        toast.success(`Task approved`, {
          id: loadingToast,
          description: `${task.taskTitle} has been approved.`,
        });
      } else if (action === "reject") {
        toast.error(`Task rejected`, {
          id: loadingToast,
          description: `${task.taskTitle} has been rejected.`,
        });
      } else {
        toast.warning(`Task requires rework`, {
          id: loadingToast,
          description: `${task.taskTitle} has been sent back for rework.`,
        });
      }

      fetchAllData(); 
    } catch (err) {
      console.error("Quick action failed:", err);
      toast.error("Quick action failed.", { id: loadingToast });
    }
  };

  const handleVerifyClick = (task: VerificationTask) => {
    setSelectedTask(task);
    setPhotos([]);
    setNotes("");
    setQuality("good");
    setVerificationStatus("approved");
    setVerificationDialogOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search tasks..."
            className="pl-8"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <Tabs defaultValue="all" onValueChange={setFilter}>
        <TabsList className="hidden md:block">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="pending verification">Pending</TabsTrigger>
          <TabsTrigger value="approved">Approved</TabsTrigger>
          <TabsTrigger value="rework">Rework</TabsTrigger>
          <TabsTrigger value="rejected">Rejected</TabsTrigger>
        </TabsList>
        <div className="block md:hidden">
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="pending_verification">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rework">Rework</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Tabs>

      <div className="border rounded-md">
        {/* Desktop Table */}
        <div className="hidden md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Task</TableHead>
                <TableHead>Project / Unit</TableHead>
                <TableHead>Contractor</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="text-center py-6 text-muted-foreground"
                  >
                    Loading tasks...
                  </TableCell>
                </TableRow>
              ) : error ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="text-center py-6 text-red-500"
                  >
                    {error}
                  </TableCell>
                </TableRow>
              ) : filteredTasks.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="text-center py-6 text-muted-foreground"
                  >
                    No tasks found matching your filters
                  </TableCell>
                </TableRow>
              ) : (
                filteredTasks.map((task) => (
                  <TableRow key={task._id}>
                    <TableCell className="font-medium">
                      {task.taskTitle}
                    </TableCell>
                    <TableCell>
                      {task.projectName} / {task.unit}
                    </TableCell>
                    <TableCell>{task.contractorName}</TableCell>
                    <TableCell>
                      {new Date(
                        task.submittedByContractorOn
                      ).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          statusColors[task.status] || "bg-gray-100"
                        }
                      >
                        {task.status.charAt(0).toUpperCase() +
                          task.status.slice(1)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={priorityColors[task.priority]}
                      >
                        {task.priority.charAt(0).toUpperCase() +
                          task.priority.slice(1)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end space-x-1">
                        {task.status === "pending verification" && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-green-600 hover:text-green-800 hover:bg-green-100"
                              title="Approve"
                              onClick={() =>
                                handleQuickAction(task, "approved")
                              }
                            >
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-amber-600 hover:text-amber-800 hover:bg-amber-100"
                              title="Request Rework"
                              onClick={() =>
                                handleQuickAction(task, "rework")
                              }
                            >
                              <AlertCircle className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-red-600 hover:text-red-800 hover:bg-red-100"
                              title="Reject"
                              onClick={() =>
                                handleQuickAction(task, "rejected")
                              }
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleVerifyClick(task)}
                        >
                          <Camera className="h-4 w-4 mr-1" />
                          {task.status === "pending verification"
                            ? "Verify"
                            : "View"}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Mobile Cards */}
        <div className="block md:hidden">
          {loading ? (
            <div className="p-4 text-center text-muted-foreground">
              Loading tasks...
            </div>
          ) : error ? (
            <div className="p-4 text-center text-red-500">{error}</div>
          ) : filteredTasks.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground">
              No tasks found matching your filters
            </div>
          ) : (
            filteredTasks.map((task) => (
              <div
                key={task._id}
                className="border rounded-lg p-4 mb-3 shadow-sm bg-white"
              >
                <div className="font-medium text-lg mb-2">{task.taskTitle}</div>
                <div className="text-sm text-muted-foreground mb-1">
                  <span className="font-semibold">Project / Unit: </span>
                  {task.projectName} / {task.unit}
                </div>
                <div className="text-sm text-muted-foreground mb-1">
                  <span className="font-semibold">Contractor: </span>
                  {task.contractorName}
                </div>
                <div className="text-sm text-muted-foreground mb-1">
                  <span className="font-semibold">Submitted: </span>
                  {new Date(task.submittedByContractorOn).toLocaleDateString()}
                </div>
                <div className="flex items-center justify-between mt-3">
                  <Badge
                    variant="outline"
                    className={
                      statusColors[task.status] || "bg-gray-100"
                    }
                  >
                    {task.status.charAt(0).toUpperCase() +
                      task.status.slice(1)}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={priorityColors[task.priority]}
                  >
                    {task.priority.charAt(0).toUpperCase() +
                      task.priority.slice(1)}
                  </Badge>
                </div>
                <div className="flex justify-end space-x-2 mt-3">
                  {task.status === "pending verification" && (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-green-600 hover:text-green-800 hover:bg-green-100"
                        title="Approve"
                        onClick={() =>
                          handleQuickAction(task, "approved")
                        }
                      >
                        <CheckCircle className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-amber-600 hover:text-amber-800 hover:bg-amber-100"
                        title="Request Rework"
                        onClick={() =>
                          handleQuickAction(task, "rework")
                        }
                      >
                        <AlertCircle className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-red-600 hover:text-red-800 hover:bg-red-100"
                        title="Reject"
                        onClick={() =>
                          handleQuickAction(task, "rejected")
                        }
                      >
                        <XCircle className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleVerifyClick(task)}
                  >
                    <Camera className="h-4 w-4 mr-1" />
                    {task.status === "pending verification" ? "Verify" : "View"}
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Verification Dialog */}
      <Dialog
        open={verificationDialogOpen}
        onOpenChange={setVerificationDialogOpen}
      >
        <DialogContent className="md:w-[600px] w-[95vw] max-h-[85vh] overflow-y-auto rounded-xl">
          <DialogHeader>
            <DialogTitle>Verify Task Completion</DialogTitle>
            <DialogDescription>
              Review the contractor's work and verify task completion.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 pt-4">
            <div className="bg-muted p-3 rounded-md">
              <p className="font-medium">
                {selectedTask?.taskTitle || "Loading..."}
              </p>
              <p className="text-sm text-muted-foreground">
                {selectedTask?.projectName || "Untitled"} /{" "}
                {selectedTask?.unit}
              </p>
              <p className="text-sm text-muted-foreground">
                Phase: {selectedTask?.constructionPhase}
              </p>
              <p className="text-sm text-muted-foreground">
                Contractor: {selectedTask?.contractorName}
              </p>
              <p className="text-sm text-muted-foreground">
                Completed on:{" "}
                {selectedTask &&
                  new Date(
                    selectedTask.submittedByContractorOn
                  ).toLocaleDateString()}
              </p>
            </div>

            <Tabs defaultValue="contractor" className="w-full">
              <TabsList className="w-full grid grid-cols-2">
                <TabsTrigger value="contractor">
                  Contractor Photos
                </TabsTrigger>
                <TabsTrigger value="verification">
                  Your Verification
                </TabsTrigger>
              </TabsList>
              <TabsContent value="contractor" className="space-y-4 pt-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {selectedTask &&
                  selectedTask.contractorUploadedPhotos &&
                  selectedTask.contractorUploadedPhotos.length > 0 ? (
                    selectedTask.contractorUploadedPhotos.map(
                      (photo, index) => (
                        <div
                          key={index}
                          className="relative rounded-md overflow-hidden border border-border"
                        >
                          <img
                            src={photo} // This is just the string URL
                            alt={`Contractor Evidence ${index + 1}`}
                            className="w-full h-48 object-cover"
                          />
                        </div>
                      )
                    )
                  ) : (
                    <p className="text-muted-foreground text-sm col-span-2 text-center">
                      No photos submitted by contractor.
                    </p>
                  )}
                </div>
              </TabsContent>
              <TabsContent value="verification" className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Upload Verification Photos</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-2">
                    {photos.map((photo, index) => (
                      <div
                        key={index}
                        className="relative rounded-md overflow-hidden border border-border"
                      >
                        <img
                          src={URL.createObjectURL(photo)}
                          alt={`Verification ${index + 1}`}
                          className="w-full h-48 object-cover"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute top-1 right-1 bg-black bg-opacity-60 hover:bg-opacity-80 rounded-full"
                          onClick={() => removePhoto(index)}
                        >
                          <XCircle className="h-4 w-4 text-white" />
                        </Button>
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1 border-dashed"
                      onClick={() =>
                        document
                          .getElementById("verification-photo-upload")
                          ?.click()
                      }
                    >
                      <Upload className="mr-2 h-4 w-4" />
                      Upload Photos
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="border-dashed"
                      onClick={() =>
                        document
                          .getElementById("verification-camera-capture")
                          ?.click()
                      }
                    >
                      <Camera className="h-4 w-4" />
                    </Button>
                  </div>
                  <Input
                    id="verification-photo-upload"
                    type="file"
                    className="hidden"
                    accept="image/*"
                    multiple
                    onChange={handleFileChange}
                  />
                  <Input
                    id="verification-camera-capture"
                    type="file"
                    className="hidden"
                    accept="image/*"
                    capture="environment"
                    onChange={handleFileChange}
                  />
                </div>
              </TabsContent>
            </Tabs>

            <div className="space-y-2">
              <Label>Quality Assessment</Label>
              <RadioGroup
                value={quality}
                onValueChange={setQuality as any}
                className="flex flex-col sm:flex-row sm:space-x-4 space-y-2 sm:space-y-0"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="excellent" id="excellent" />
                  <Label htmlFor="excellent">Excellent</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="good" id="good" />
                  <Label htmlFor="good">Good</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="acceptable" id="acceptable" />
                  <Label htmlFor="acceptable">Acceptable</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="poor" id="poor" />
                  <Label htmlFor="poor">Poor</Label>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label>Verification Decision</Label>
              <Select
                value={verificationStatus}
                onValueChange={setVerificationStatus as any}
                required
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="approved">
                    <div className="flex items-center">
                      <CheckCircle className="mr-2 h-4 w-4 text-green-600" />
                      <span>Approved - Work meets requirements</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="rework">
                    <div className="flex items-center">
                      <AlertCircle className="mr-2 h-4 w-4 text-amber-600" />
                      <span>Needs Rework - Specific corrections required</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="rejected">
                    <div className="flex items-center">
                      <XCircle className="mr-2 h-4 w-4 text-red-600" />
                      <span>Rejected - Work fails to meet standards</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes & Feedback</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={
                  verificationStatus !== "approved"
                    ? "Please describe the issues that need to be addressed"
                    : "Add any comments or feedback (optional)"
                }
                rows={3}
                required={verificationStatus !== "approved"}
              />
            </div>

            <DialogFooter className="pt-4 flex flex-col sm:flex-row gap-2">
              <Button
                type="button"
                variant="outline"
                className="w-full sm:w-auto"
                onClick={() => {
                  setVerificationDialogOpen(false);
                  setSelectedTask(null); // Clear selected task
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit" // Changed to type="submit"
                className="w-full sm:w-auto"
                disabled={isUpdating}
                variant={
                  verificationStatus === "approved"
                    ? "default"
                    : verificationStatus === "rework"
                    ? "secondary"
                    : "destructive"
                }
                onClick={handleSubmit} // Keep onClick as it's inside a form
              >
                {isUpdating ? "Submitting..." : "Submit Verification"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TaskVerificationList;