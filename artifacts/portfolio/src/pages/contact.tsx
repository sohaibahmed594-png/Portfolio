import { Layout } from "@/components/layout";
import { motion } from "framer-motion";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export default function Contact() {
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("sending");
    setTimeout(() => setStatus("sent"), 1500);
  };

  return (
    <Layout>
      <div className="pt-40 pb-24 px-6 md:px-12 max-w-4xl mx-auto w-full min-h-[80vh] flex flex-col justify-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="mb-16"
        >
          <h1 className="text-5xl md:text-7xl tracking-tighter text-white/90 mb-6">Reach Out.</h1>
          <p className="text-muted-foreground text-lg font-light max-w-xl">
            Available for collaborations, print requests, and general inquiries.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-16">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="space-y-12"
          >
            <div>
              <h3 className="text-xs tracking-widest uppercase text-white/40 mb-4">Direct</h3>
              <a
                href="mailto:sohaibahmed8664@gmail.com"
                className="text-lg text-white/90 hover:text-white transition-colors"
              >
                sohaibahmed8664@gmail.com
              </a>
            </div>
            <div>
              <h3 className="text-xs tracking-widest uppercase text-white/40 mb-4">Social</h3>
              <a
                href="https://www.instagram.com/quiet_frame_005?igsh=MTMxbXZ6MWx3eHVlaw=="
                target="_blank"
                rel="noopener noreferrer"
                className="text-white/80 hover:text-white transition-colors"
              >
                Instagram
              </a>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
          >
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label className="text-xs tracking-widest uppercase text-white/40">Name</label>
                <Input
                  required
                  className="bg-transparent border-0 border-b border-white/20 rounded-none px-0 focus-visible:ring-0 focus-visible:border-white/60 transition-colors"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs tracking-widest uppercase text-white/40">Email</label>
                <Input
                  type="email"
                  required
                  className="bg-transparent border-0 border-b border-white/20 rounded-none px-0 focus-visible:ring-0 focus-visible:border-white/60 transition-colors"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs tracking-widest uppercase text-white/40">Message</label>
                <Textarea
                  required
                  className="bg-transparent border-0 border-b border-white/20 rounded-none px-0 focus-visible:ring-0 focus-visible:border-white/60 transition-colors min-h-[120px] resize-none"
                />
              </div>
              <Button
                type="submit"
                disabled={status !== "idle"}
                className="w-full bg-white text-black hover:bg-white/90 tracking-widest uppercase text-xs h-12"
              >
                {status === "idle" ? "Send Message" : status === "sending" ? "Sending..." : "Message Sent"}
              </Button>
            </form>
          </motion.div>
        </div>
      </div>
    </Layout>
  );
}
