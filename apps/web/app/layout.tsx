import "./globals.css";import {Header} from "@/components/Header";
export const metadata={title:"Kalabsha Airlines",description:"Fly To Dreams"};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="en"><body><Header/>{children}<footer className="footer"><div className="container">© 2026 Kalabsha Airlines · Fly To Dreams</div></footer></body></html>}