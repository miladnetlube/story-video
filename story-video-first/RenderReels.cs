using System;
using System.IO;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.Drawing.Text;
using System.Runtime.InteropServices;

class RenderReels
{
    const int WIDTH = 1080;
    const int HEIGHT = 1920;
    const int FPS = 30;
    const int TOTAL_FRAMES = 900; // Exact 30.00 seconds

    static Bitmap LoadAndNormalize(string path)
    {
        using (var src = new Bitmap(path))
        {
            var dst = new Bitmap(WIDTH, HEIGHT, PixelFormat.Format32bppPArgb);
            using (var g = Graphics.FromImage(dst))
            {
                g.InterpolationMode = InterpolationMode.HighQualityBicubic;
                g.SmoothingMode = SmoothingMode.HighQuality;
                g.PixelOffsetMode = PixelOffsetMode.HighQuality;

                // Center-crop to exact 9:16 if needed
                float srcAspect = (float)src.Width / src.Height;
                float dstAspect = (float)WIDTH / HEIGHT;
                RectangleF srcRect;
                if (srcAspect > dstAspect)
                {
                    float newW = src.Height * dstAspect;
                    srcRect = new RectangleF((src.Width - newW) / 2f, 0, newW, src.Height);
                }
                else
                {
                    float newH = src.Width / dstAspect;
                    srcRect = new RectangleF(0, (src.Height - newH) / 2f, src.Width, newH);
                }
                g.DrawImage(src, new RectangleF(0, 0, WIDTH, HEIGHT), srcRect, GraphicsUnit.Pixel);
            }
            return dst;
        }
    }

    // Create a soft bokeh-blurred copy of a bitmap for Scene 6 rack-focus effect
    static Bitmap CreateBlurredBackground(Bitmap src)
    {
        int smallW = WIDTH / 12;
        int smallH = HEIGHT / 12;
        using (var tiny = new Bitmap(smallW, smallH, PixelFormat.Format32bppPArgb))
        {
            using (var g1 = Graphics.FromImage(tiny))
            {
                g1.InterpolationMode = InterpolationMode.HighQualityBilinear;
                g1.DrawImage(src, new Rectangle(0, 0, smallW, smallH));
            }
            var blurred = new Bitmap(WIDTH, HEIGHT, PixelFormat.Format32bppPArgb);
            using (var g2 = Graphics.FromImage(blurred))
            {
                g2.InterpolationMode = InterpolationMode.HighQualityBicubic;
                g2.DrawImage(tiny, new Rectangle(0, 0, WIDTH, HEIGHT));
            }
            return blurred;
        }
    }

    static float SmoothStep(float t)
    {
        t = Math.Max(0f, Math.Min(1f, t));
        return t * t * (3f - 2f * t);
    }

    static void DrawZoomPan(Graphics g, Bitmap bmp, float zoom, float panX, float panY)
    {
        float cropW = WIDTH / zoom;
        float cropH = HEIGHT / zoom;
        float cx = (WIDTH * (0.5f + panX)) - (cropW / 2f);
        float cy = (HEIGHT * (0.5f + panY)) - (cropH / 2f);
        cx = Math.Max(0f, Math.Min(WIDTH - cropW, cx));
        cy = Math.Max(0f, Math.Min(HEIGHT - cropH, cy));

        g.DrawImage(bmp, new RectangleF(0, 0, WIDTH, HEIGHT), new RectangleF(cx, cy, cropW, cropH), GraphicsUnit.Pixel);
    }

    static GraphicsPath CreateRoundedRect(RectangleF rect, float radius)
    {
        float d = radius * 2f;
        var path = new GraphicsPath();
        path.AddArc(rect.X, rect.Y, d, d, 180, 90);
        path.AddArc(rect.Right - d, rect.Y, d, d, 270, 90);
        path.AddArc(rect.Right - d, rect.Bottom - d, d, d, 0, 90);
        path.AddArc(rect.X, rect.Bottom - d, d, d, 90, 90);
        path.CloseFigure();
        return path;
    }

    static void DrawCherryBlossom(Graphics g, float cx, float cy, float size, int alpha)
    {
        var state = g.Save();
        g.TranslateTransform(cx, cy);
        using (var petalBrush = new SolidBrush(Color.FromArgb(alpha, 255, 182, 205)))
        using (var petalBorder = new Pen(Color.FromArgb((int)(alpha * 0.8f), 230, 130, 165), 1.5f))
        {
            for (int i = 0; i < 5; i++)
            {
                var st2 = g.Save();
                g.RotateTransform(i * 72f - 18f);
                RectangleF petal = new RectangleF(-size * 0.28f, -size * 0.85f, size * 0.56f, size * 0.72f);
                g.FillEllipse(petalBrush, petal);
                g.DrawEllipse(petalBorder, petal);
                g.Restore(st2);
            }
        }
        using (var centerBrush = new SolidBrush(Color.FromArgb(alpha, 255, 215, 90)))
        {
            g.FillEllipse(centerBrush, -size * 0.22f, -size * 0.22f, size * 0.44f, size * 0.44f);
        }
        g.Restore(state);
    }

    static void DrawPersianSubtitle(Graphics g, string text, float yCenter, float fontSize, float alpha, bool isTitleCard, bool hasFlowerIcon = false)
    {
        if (alpha <= 0.01f || string.IsNullOrEmpty(text)) return;
        int a = (int)(Math.Max(0f, Math.Min(1f, alpha)) * 255);

        using (var sf = new StringFormat(StringFormatFlags.DirectionRightToLeft))
        {
            sf.Alignment = StringAlignment.Center;
            sf.LineAlignment = StringAlignment.Center;

            using (var font = new Font("Segoe UI", fontSize, FontStyle.Bold, GraphicsUnit.Pixel))
            {
                SizeF measured = g.MeasureString(text, font, new SizeF(WIDTH - 180, 300), sf);
                float iconSpace = hasFlowerIcon ? 52f : 0f;
                float padX = isTitleCard ? 46f : 36f;
                float padY = isTitleCard ? 22f : 16f;
                float boxW = Math.Min(WIDTH - 100, measured.Width + iconSpace + padX * 2f);
                float boxH = measured.Height + padY * 2f;
                RectangleF pillRect = new RectangleF((WIDTH - boxW) / 2f, yCenter - boxH / 2f, boxW, boxH);

                using (var path = CreateRoundedRect(pillRect, isTitleCard ? 32f : 26f))
                {
                    // Warm pastel glassmorphic pill in safe zone
                    Color bgCol = isTitleCard
                        ? Color.FromArgb((int)(a * 0.86f), 255, 246, 249) // Soft cream-pink card for hook/ending titles
                        : Color.FromArgb((int)(a * 0.72f), 38, 26, 34);   // Cinematic dark plum-charcoal pill for subtitles

                    using (var brush = new SolidBrush(bgCol))
                    {
                        g.FillPath(brush, path);
                    }

                    Color borderCol = isTitleCard
                        ? Color.FromArgb((int)(a * 0.90f), 240, 195, 210)
                        : Color.FromArgb((int)(a * 0.40f), 255, 230, 240);
                    using (var pen = new Pen(borderCol, 2.0f))
                    {
                        g.DrawPath(pen, path);
                    }
                }

                RectangleF textRect = hasFlowerIcon
                    ? new RectangleF(pillRect.X + iconSpace * 0.75f, pillRect.Y, pillRect.Width - iconSpace * 0.75f, pillRect.Height)
                    : pillRect;

                // Soft text shadow
                RectangleF shadowRect = new RectangleF(textRect.X, textRect.Y + 2f, textRect.Width, textRect.Height);
                Color shadowCol = isTitleCard
                    ? Color.FromArgb((int)(a * 0.25f), 120, 70, 90)
                    : Color.FromArgb((int)(a * 0.80f), 0, 0, 0);
                using (var sBrush = new SolidBrush(shadowRect.Width > 0 ? shadowCol : Color.Transparent))
                {
                    g.DrawString(text, font, sBrush, shadowRect, sf);
                }

                Color textCol = isTitleCard
                    ? Color.FromArgb(a, 92, 45, 68)    // Deep rosewood for title card
                    : Color.FromArgb(a, 255, 250, 252); // Warm cream-white for subtitles
                using (var tBrush = new SolidBrush(textCol))
                {
                    g.DrawString(text, font, tBrush, textRect, sf);
                }

                if (hasFlowerIcon)
                {
                    DrawCherryBlossom(g, pillRect.X + padX + 14f, pillRect.Y + pillRect.Height / 2f, 22f, a);
                }
            }
        }
    }

    static void Main(string[] args)
    {
        string baseDir = AppDomain.CurrentDomain.BaseDirectory;
        string keyDir = Path.Combine(baseDir, "keyframes");

        Console.WriteLine("Loading 8 high-resolution 9:16 keyframes...");
        var s1  = LoadAndNormalize(Path.Combine(keyDir, "scene_01_macro_hook.jpg"));
        var s2  = LoadAndNormalize(Path.Combine(keyDir, "scene_02_desk_working.jpg"));
        var s3a = LoadAndNormalize(Path.Combine(keyDir, "scene_03a_shaping_petals.jpg"));
        var s3b = LoadAndNormalize(Path.Combine(keyDir, "scene_03b_assembling_flower.jpg"));
        var s3c = LoadAndNormalize(Path.Combine(keyDir, "scene_03c_arranging_bouquet.jpg"));
        var s4  = LoadAndNormalize(Path.Combine(keyDir, "scene_04_order_notification.jpg"));
        var s5  = LoadAndNormalize(Path.Combine(keyDir, "scene_05_proud_pullback.jpg"));
        var s6  = LoadAndNormalize(Path.Combine(keyDir, "scene_06_final_bouquet.jpg"));
        var s6Blur = CreateBlurredBackground(s6);

        string ffmpegPath = Path.Combine(baseDir, "ffmpeg.exe");
        string rawVideoPath = Path.Combine(baseDir, "visual_master_30s.mp4");

        var psi = new ProcessStartInfo
        {
            FileName = ffmpegPath,
            Arguments = "-y -f rawvideo -pix_fmt bgra -s 1080x1920 -r 30 -i - -c:v libx264 -preset veryfast -crf 18 -pix_fmt yuv420p \"" + rawVideoPath + "\"",
            UseShellExecute = false,
            RedirectStandardInput = true,
            CreateNoWindow = true
        };

        Console.WriteLine("Rendering 900 cinematic frames (30.00s @ 30fps, 1080x1920)...");
        using (var proc = Process.Start(psi))
        using (var stdin = proc.StandardInput.BaseStream)
        using (var canvas = new Bitmap(WIDTH, HEIGHT, PixelFormat.Format32bppPArgb))
        using (var g = Graphics.FromImage(canvas))
        {
            g.InterpolationMode = InterpolationMode.HighQualityBicubic;
            g.SmoothingMode = SmoothingMode.AntiAlias;
            g.PixelOffsetMode = PixelOffsetMode.HighQuality;
            g.TextRenderingHint = TextRenderingHint.AntiAliasGridFit;

            byte[] frameBytes = new byte[WIDTH * HEIGHT * 4];

            for (int f = 0; f < TOTAL_FRAMES; f++)
            {
                float t = f / (float)FPS;

                // --- SCENE 1: 00:00 - 00:03 (90 frames) ---
                if (f < 90)
                {
                    float u = SmoothStep(f / 89f);
                    // Smooth camera push-in toward the pink paper rose held up to the window light
                    float zoom = 1.00f + 0.12f * u;
                    float panY = -0.02f * u;
                    DrawZoomPan(g, s1, zoom, 0f, panY);

                    // On-screen text hook: «۱۸ سالمه...» in top safe zone
                    float titleAlpha = f < 10 ? f / 10f : (f > 78 ? (89 - f) / 11f : 1f);
                    DrawPersianSubtitle(g, "۱۸ سالمه...", 310f, 52f, titleAlpha, true);

                    // Narration subtitle in bottom safe zone
                    float subAlpha = f < 6 ? f / 6f : (f > 80 ? (89 - f) / 9f : 1f);
                    DrawPersianSubtitle(g, "من ۱۸ سالمه...", 1540f, 42f, subAlpha, false);
                }
                // --- SCENE 2: 00:03 - 00:08 (150 frames: 90..239) ---
                else if (f < 240)
                {
                    int sf = f - 90;
                    float u = SmoothStep(sf / 149f);
                    // Camera transitions smoothly from closer view of hands to profile/desk view
                    float zoom = 1.15f - 0.13f * u;
                    float panX = -0.03f * (1f - u);
                    float panY = 0.04f * (1f - u);
                    DrawZoomPan(g, s2, zoom, panX, panY);

                    float subAlpha = sf < 10 ? sf / 10f : (sf > 136 ? (149 - sf) / 13f : 1f);
                    DrawPersianSubtitle(g, "و دارم با دستام، رویامو می‌سازم.", 1540f, 42f, subAlpha, false);
                }
                // --- SCENE 3: 00:08 - 00:13 (150 frames: 240..389) - 3 Rhythmic Cuts ---
                else if (f < 390)
                {
                    int sf = f - 240;
                    if (sf < 50)
                    {
                        // Shot 3A (08:00 - 09:67): Shaping paper petals by hand
                        float u = SmoothStep(sf / 49f);
                        DrawZoomPan(g, s3a, 1.01f + 0.08f * u, 0.01f * u, 0f);
                    }
                    else if (sf < 100)
                    {
                        // Shot 3B (09:67 - 11:33): Attaching petals into a full paper rose
                        float u = SmoothStep((sf - 50) / 49f);
                        DrawZoomPan(g, s3b, 1.09f - 0.07f * u, -0.01f * u, 0.01f * u);
                    }
                    else
                    {
                        // Shot 3C (11:33 - 13:00): Arranging pink, white, and lilac flowers into a bouquet
                        float u = SmoothStep((sf - 100) / 49f);
                        DrawZoomPan(g, s3c, 1.01f + 0.08f * u, 0f, -0.015f * u);
                    }

                    float subAlpha = sf < 10 ? sf / 10f : (sf > 136 ? (149 - sf) / 13f : 1f);
                    DrawPersianSubtitle(g, "همه‌چی از یه علاقه کوچیک شروع شد...", 1540f, 42f, subAlpha, false);
                }
                // --- SCENE 4: 00:13 - 00:19 (180 frames: 390..569) ---
                else if (f < 570)
                {
                    int sf = f - 390;
                    float u = SmoothStep(sf / 179f);
                    float zoom = 1.01f + 0.09f * u;
                    DrawZoomPan(g, s4, zoom, 0f, -0.01f * u);

                    // Subtle warm notification glow pulse around t = 13.4s - 15.0s (no gibberish text)
                    if (sf >= 10 && sf <= 65)
                    {
                        float pulse = (float)Math.Sin(((sf - 10) / 55f) * Math.PI);
                        using (var glowPath = new GraphicsPath())
                        {
                            RectangleF glowRect = new RectangleF(WIDTH * 0.52f, HEIGHT * 0.68f, 260f, 260f);
                            glowPath.AddEllipse(glowRect);
                            using (var pgb = new PathGradientBrush(glowPath))
                            {
                                pgb.CenterColor = Color.FromArgb((int)(pulse * 55), 255, 220, 235);
                                pgb.SurroundColors = new Color[] { Color.FromArgb(0, 255, 220, 235) };
                                g.FillPath(pgb, glowPath);
                            }
                        }
                    }

                    float subAlpha = sf < 12 ? sf / 12f : (sf > 165 ? (179 - sf) / 14f : 1f);
                    DrawPersianSubtitle(g, "حالا هر سفارشی که می‌گیرم، بهم امید می‌ده.", 1540f, 40f, subAlpha, false);
                }
                // --- SCENE 5: 00:19 - 00:25 (180 frames: 570..749) ---
                else if (f < 750)
                {
                    int sf = f - 570;
                    float u = SmoothStep(sf / 179f);
                    // Smooth camera pull-back (zoom 1.18 -> 1.00) revealing the desk and finished bouquets
                    float zoom = 1.18f - 0.18f * u;
                    float panY = -0.03f * (1f - u);
                    DrawZoomPan(g, s5, zoom, 0f, panY);

                    float subAlpha = sf < 12 ? sf / 12f : (sf > 165 ? (179 - sf) / 14f : 1f);
                    DrawPersianSubtitle(g, "شاید کوچیک شروع کرده باشم، ولی رؤیام خیلی بزرگه.", 1540f, 38f, subAlpha, false);
                }
                // --- SCENE 6: 00:25 - 00:30 (150 frames: 750..899) ---
                else
                {
                    int sf = f - 750;
                    float u = SmoothStep(sf / 149f);
                    float zoom = 1.00f + 0.10f * u;

                    // Draw sharp frame first
                    DrawZoomPan(g, s6, zoom, 0f, 0.01f * u);

                    // Progressive rack-focus bokeh blur on the upper background while keeping foreground bouquet sharp
                    float blurStrength = SmoothStep(Math.Min(1f, sf / 90f)) * 0.65f;
                    if (blurStrength > 0.02f)
                    {
                        ColorMatrix cm = new ColorMatrix();
                        cm.Matrix33 = blurStrength;
                        using (var ia = new ImageAttributes())
                        {
                            ia.SetColorMatrix(cm, ColorMatrixFlag.Default, ColorAdjustType.Bitmap);
                            // Apply soft background blur to upper 42% of frame (above the bouquet)
                            g.DrawImage(s6Blur, new Rectangle(0, 0, WIDTH, (int)(HEIGHT * 0.42f)),
                                0, 0, WIDTH, (int)(HEIGHT * 0.42f), GraphicsUnit.Pixel, ia);
                        }
                    }

                    // Narration subtitle (25.0s - 28.0s)
                    if (sf < 90)
                    {
                        float subAlpha = sf < 10 ? sf / 10f : (sf > 76 ? (90 - sf) / 14f : 1f);
                        DrawPersianSubtitle(g, "این تازه شروع داستان منه...", 1560f, 42f, subAlpha, false);
                    }

                    // Final on-screen text (27.2s - 30.0s): «شروع یه رؤیای کوچیک 🌸» in safe zone
                    if (sf >= 66)
                    {
                        float endAlpha = sf < 84 ? (sf - 66) / 18f : 1f;
                        DrawPersianSubtitle(g, "شروع یه رؤیای کوچیک", 310f, 48f, endAlpha, true, true);
                    }
                }

                // Subtle warm sunlit vignette across all scenes for cohesive cinematic look
                var bmpData = canvas.LockBits(new Rectangle(0, 0, WIDTH, HEIGHT), ImageLockMode.ReadOnly, PixelFormat.Format32bppPArgb);
                Marshal.Copy(bmpData.Scan0, frameBytes, 0, frameBytes.Length);
                canvas.UnlockBits(bmpData);

                stdin.Write(frameBytes, 0, frameBytes.Length);
            }

            stdin.Flush();
            stdin.Close();
            proc.WaitForExit();
        }

        Console.WriteLine("Successfully rendered visual_master_30s.mp4!");
    }
}
