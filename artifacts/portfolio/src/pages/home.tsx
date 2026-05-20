import { Layout } from "@/components/layout";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import staticHero from "@/assets/images/hero.png";

interface UploadedImage {
  url: string;
  filename: string;
  title: string;
}

interface SiteMeta {
  hero?: { url: string };
  about?: { url: string };
}

export default function Home() {
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  const { data: uploadedData } = useQuery<{ images: UploadedImage[] }>({
    queryKey: ["gallery-images"],
    queryFn: async () => {
      const res = await fetch("/api/admin/images");
      if (!res.ok) return { images: [] };
      return res.json();
    },
    refetchInterval: false,
  });

  const { data: siteMeta } = useQuery<SiteMeta>({
    queryKey: ["site-images"],
    queryFn: async () => {
      const res = await fetch("/api/admin/site-images");
      if (!res.ok) return {};
      return res.json();
    },
    refetchInterval: false,
  });

  const heroSrc = siteMeta?.hero?.url ?? staticHero;

  const photos = (uploadedData?.images ?? []).map((img) => ({
    src: img.url,
    title: img.title,
  }));

  return (
    <Layout>
      <section className="relative h-screen w-full flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img
            src={heroSrc}
            alt="Hero landscape"
            className="w-full h-full object-cover opacity-80"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-background/20 via-transparent to-background" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.5, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="relative z-10 text-center"
        >
          <h1
            className="text-5xl md:text-7xl lg:text-8xl tracking-tight text-white/90"
            style={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 300 }}
          >
            Shaikh Sohaib Ahmed
          </h1>
          <p className="mt-6 text-sm md:text-base tracking-[0.3em] uppercase text-white/60">
            Fine Art Photography
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 2 }}
          className="absolute bottom-12 left-1/2 -translate-x-1/2 flex flex-col items-center gap-4"
        >
          <span className="text-[10px] tracking-widest uppercase text-white/50">Scroll</span>
          <div className="w-[1px] h-12 bg-gradient-to-b from-white/50 to-transparent" />
        </motion.div>
      </section>

      <section className="py-32 px-6 md:px-12 max-w-screen-2xl mx-auto w-full">
        {photos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 text-center">
            <p className="text-white/20 text-xs tracking-[0.3em] uppercase">No photos yet</p>
            <p className="text-white/10 text-xs tracking-wide mt-3">
              Upload images via the admin panel to populate the gallery
            </p>
          </div>
        ) : (
          <div className="columns-1 md:columns-2 lg:columns-3 gap-6 space-y-6">
            {photos.map((photo, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.8, delay: (i % 3) * 0.1 }}
                className="break-inside-avoid relative group cursor-zoom-in"
                onClick={() => setSelectedPhoto(photo.src)}
              >
                <img
                  src={photo.src}
                  alt={photo.title}
                  className="w-full h-auto object-cover opacity-90 group-hover:opacity-100 transition-opacity duration-500"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-500 flex items-center justify-center">
                  <span className="text-white text-sm tracking-widest uppercase">{photo.title}</span>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </section>

      <AnimatePresence>
        {selectedPhoto && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4 md:p-12 cursor-zoom-out"
            onClick={() => setSelectedPhoto(null)}
          >
            <motion.img
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              transition={{ duration: 0.4 }}
              src={selectedPhoto}
              className="max-w-full max-h-full object-contain"
              alt="Fullscreen view"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </Layout>
  );
}
