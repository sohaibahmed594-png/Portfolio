import { Layout } from "@/components/layout";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";

import staticPortrait from "@/assets/images/about-portrait.png";

interface SiteMeta {
  hero?: { url: string };
  about?: { url: string };
}

export default function About() {
  const { data: siteMeta } = useQuery<SiteMeta>({
    queryKey: ["site-images"],
    queryFn: async () => {
      const res = await fetch("/api/admin/site-images");
      if (!res.ok) return {};
      return res.json();
    },
    refetchInterval: false,
  });

  const portraitSrc = siteMeta?.about?.url ?? staticPortrait;

  return (
    <Layout>
      <div className="pt-32 pb-24 px-6 md:px-12 max-w-6xl mx-auto w-full min-h-[80vh] flex flex-col md:flex-row gap-16 md:gap-24 items-center">
        <motion.div
          initial={{ opacity: 0, filter: "blur(10px)" }}
          animate={{ opacity: 1, filter: "blur(0px)" }}
          transition={{ duration: 1.2 }}
          className="w-full md:w-5/12 aspect-[3/4]"
        >
          <img
            src={portraitSrc}
            alt="Shaikh Sohaib Ahmed"
            className="w-full h-full object-cover grayscale-[30%] opacity-90"
          />
        </motion.div>

        <div className="w-full md:w-7/12 space-y-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="space-y-8"
          >
            <h1 className="text-4xl md:text-5xl lg:text-6xl tracking-tight text-white/90">
              Found in the Frame.
            </h1>
            <div className="space-y-6 text-muted-foreground text-lg leading-relaxed font-light">
              <p>
                My photography is rooted in the unscripted — the raw, unguarded moments that happen
                when the world forgets the camera is there. I work across street, wildlife, and animal
                photography, drawn to the unpredictable energy of life as it unfolds.
              </p>
              <p>
                On the street, I look for tension, rhythm, and the quiet stories written on faces and
                walls. In the wild, I wait — sometimes for hours — for a single honest moment between
                a creature and its world. Each photograph is a record of patience and presence.
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </Layout>
  );
}
